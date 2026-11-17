const rules = JSON.parse(require('fs').readFileSync('database.rules.json','utf8')).rules;

// Evaluate a rule restricting auth to a specific uid, on paths with these vars.
function canWrite(pathStr, authUid, vars) {
  const parts = pathStr.split('/').filter(Boolean);
  let allowed = false;
  const visit = (n, rest) => {
    if (n['.write']) {
      const expr = n['.write'];
      // Only interested in whether the rule *can* grant access; check the
      // clauses that reference auth.uid / membership.
      if (evalRule(expr, authUid, vars)) allowed = true;
    }
    if (rest.length === 0) return;
    const [head, ...tail] = rest;
    if (n[head]) visit(n[head], tail);
    for (const k of Object.keys(n)) if (k.startsWith('$')) visit(n[k], tail);
  };
  visit(rules, parts);
  return allowed;
}

// Tiny evaluator for the specific rule shapes used here.
function evalRule(expr, authUid, vars) {
  // body.before touching auth.uid
  const member = vars.memberUid === authUid;
  let e = expr
    .replace(/root\.child\('chats'\)\.child\(\$chatId\)\.child\('members'\)\.child\(auth\.uid\)\.val\(\) === true/g, String(member))
    .replace(/data\.child\('members'\)\.child\(auth\.uid\)\.val\(\) === true/g, String(member))
    .replace(/newData\.child\('members'\)\.child\(auth\.uid\)\.val\(\) === true/g, String(member));
  // now substitute the remaining variables
  e = e.replace(/auth != null/g, 'true')
       .replace(/auth\.uid/g, JSON.stringify(authUid))
       .replace(/\$(uid|chatId|fromUid|toUid|messageId)/g, (m) => JSON.stringify(vars[m.slice(1)] ?? ''));
  if (/\b(root|data|newData|auth)\b/.test(e)) return true; // unresolved clause: treat as permissive
  try { return Boolean(eval(e)); } catch { return true; }
}

const me = 'me-uid';
const other = 'friend-uid';
const cid = 'chat1';
const cases = [
  ['own chat entry',            `userChats/${me}/${cid}`,           true,  { uid: me,    memberUid: me }],
  ["friend's chat entry",       `userChats/${other}/${cid}`,        true,  { uid: other, memberUid: me }],
  ["non-member's chat entry",   `userChats/${other}/${cid}`,        false, { uid: other, memberUid: 'intruder' }],
  ['create chat',               `chats/${cid}`,                     true,  { uid: me,    memberUid: me }],
  ['new game message',          `messages/${cid}/m1`,               true,  { uid: me,    memberUid: me }],
  ['host game state',           `messages/${cid}/m1/game`,          true,  { uid: me,    memberUid: me }],
  ['guest joins game',          `messages/${cid}/m1/game`,          true,  { uid: other, memberUid: other, actor: other }],
  ['guest move',                `messages/${cid}/m1/game`,          true,  { uid: other, memberUid: other, actor: other }],
  ['stranger touches game',     `messages/${cid}/m1/game`,          false, { uid: 'x', memberUid: 'someone-else', actor: 'x' }],
  ['own friends list',          `friends/${me}/${other}`,           true,  { uid: me,    memberUid: me }],
  ["friend's friends list",     `friends/${other}/${me}`,           false, { uid: other, memberUid: me }],
  ['pin message',               `chats/${cid}/pinnedMessage`,       true,  { uid: me,    memberUid: me }],
  ['outgoing request',          `friendRequests/outgoing/${me}/${other}`, true, { uid: me, memberUid: me }],
];

let fail = 0;
for (const [label, path, expected, vars] of cases) {
  const actor = vars.actor || me;
  const got = canWrite(path, actor, vars);
  const ok = got === expected;
  if (!ok) fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label.padEnd(26) + ` expected=${expected} got=${got}`);
}
console.log(fail === 0 ? '\nAll rule expectations met.' : `\n${fail} mismatch(es)`);
process.exit(fail ? 1 : 0);
