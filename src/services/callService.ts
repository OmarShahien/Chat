import {
  ref,
  set,
  update,
  push,
  remove,
  onValue,
  onChildAdded,
  type Unsubscribe,
} from 'firebase/database';
import { db } from '../firebase';
import type { CallSession, UserProfile } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface ActiveRtcController {
  callId: string;
  pc: RTCPeerConnection;
  localStream: MediaStream;
  remoteStream: MediaStream;
  toggleMute: (muted: boolean) => void;
  hangup: () => Promise<void>;
}

export async function startOutgoingVoiceCall(
  caller: UserProfile,
  callee: UserProfile,
  onRemoteTrack: (stream: MediaStream) => void,
  onStatusChange: (session: CallSession | null) => void
): Promise<ActiveRtcController> {
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const remoteStream = new MediaStream();
  const pc = new RTCPeerConnection(RTC_CONFIG);

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
    onRemoteTrack(remoteStream);
  };

  const callRef = push(ref(db, 'calls'));
  const callId = callRef.key!;
  const now = Date.now();

  const initialSession: CallSession = {
    id: callId,
    callerId: caller.uid,
    callerName: caller.displayName,
    callerPhoto: caller.photoURL || '',
    calleeId: callee.uid,
    calleeName: callee.displayName,
    calleePhoto: callee.photoURL || '',
    status: 'ringing',
    createdAt: now,
  };

  await set(callRef, initialSession);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const candRef = push(ref(db, `calls/${callId}/callerCandidates`));
      set(candRef, e.candidate.toJSON()).catch(() => {});
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await update(callRef, {
    offer: { type: offer.type, sdp: offer.sdp || '' },
  });

  // Notify callee
  await set(ref(db, `userCalls/${callee.uid}/${callId}`), {
    callId,
    callerId: caller.uid,
    callerName: caller.displayName,
    callerPhoto: caller.photoURL || '',
    createdAt: now,
  });

  let remoteDescSet = false;
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onValue(callRef, async (snap) => {
      if (!snap.exists()) {
        onStatusChange(null);
        return;
      }
      const data = snap.val() as CallSession;
      onStatusChange(data);
      if (data.answer && !remoteDescSet && pc.signalingState !== 'closed') {
        remoteDescSet = true;
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
      }
    })
  );

  unsubs.push(
    onChildAdded(ref(db, `calls/${callId}/calleeCandidates`), (snap) => {
      if (snap.exists() && pc.signalingState !== 'closed') {
        pc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
      }
    })
  );

  const cleanup = async () => {
    unsubs.forEach((u) => u());
    localStream.getTracks().forEach((t) => t.stop());
    if (pc.signalingState !== 'closed') pc.close();
    await update(callRef, { status: 'ended' }).catch(() => {});
    await remove(ref(db, `userCalls/${callee.uid}/${callId}`)).catch(() => {});
  };

  return {
    callId,
    pc,
    localStream,
    remoteStream,
    toggleMute: (muted: boolean) => {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    },
    hangup: cleanup,
  };
}

export async function answerIncomingVoiceCall(
  session: CallSession,
  onRemoteTrack: (stream: MediaStream) => void,
  onStatusChange: (session: CallSession | null) => void
): Promise<ActiveRtcController> {
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const remoteStream = new MediaStream();
  const pc = new RTCPeerConnection(RTC_CONFIG);

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
    onRemoteTrack(remoteStream);
  };

  const callId = session.id;
  const callRef = ref(db, `calls/${callId}`);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const candRef = push(ref(db, `calls/${callId}/calleeCandidates`));
      set(candRef, e.candidate.toJSON()).catch(() => {});
    }
  };

  if (session.offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(session.offer));
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await update(callRef, {
    answer: { type: answer.type, sdp: answer.sdp || '' },
    status: 'connected',
    connectedAt: Date.now(),
  });

  await remove(ref(db, `userCalls/${session.calleeId}/${callId}`)).catch(() => {});

  const unsubs: Unsubscribe[] = [];
  unsubs.push(
    onValue(callRef, (snap) => {
      onStatusChange(snap.exists() ? (snap.val() as CallSession) : null);
    })
  );

  unsubs.push(
    onChildAdded(ref(db, `calls/${callId}/callerCandidates`), (snap) => {
      if (snap.exists() && pc.signalingState !== 'closed') {
        pc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
      }
    })
  );

  const cleanup = async () => {
    unsubs.forEach((u) => u());
    localStream.getTracks().forEach((t) => t.stop());
    if (pc.signalingState !== 'closed') pc.close();
    await update(callRef, { status: 'ended' }).catch(() => {});
    await remove(ref(db, `userCalls/${session.calleeId}/${callId}`)).catch(() => {});
  };

  return {
    callId,
    pc,
    localStream,
    remoteStream,
    toggleMute: (muted: boolean) => {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    },
    hangup: cleanup,
  };
}

export async function declineIncomingVoiceCall(calleeUid: string, callId: string): Promise<void> {
  await update(ref(db, `calls/${callId}`), { status: 'declined' }).catch(() => {});
  await remove(ref(db, `userCalls/${calleeUid}/${callId}`)).catch(() => {});
}
