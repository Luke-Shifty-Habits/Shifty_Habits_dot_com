// Forwards a shared roster link (/roster/link/#v=1…) to the calendar page,
// keeping the #fragment, which holds the whole roster and never reaches a
// server. replace(), so Back doesn't land here again. /roster/index.html, not
// /roster/, since app 1.1.40 claims the bare path (see the README).
location.replace('../index.html' + location.hash);
