/**
 * Defusing Zalo group mentions in text we didn't write.
 *
 * Mentions are a string convention inside the message body — `[@user_id]` for
 * one person, `[@group_id]` for everyone — not a structured field Zalo parses
 * separately. That makes any relayed text an injection vector: a guest who
 * types "[@...]" into a booking's special-requests box would otherwise ping the
 * whole team from the notification that quotes them.
 *
 * Kept deliberately free of imports. It is the one piece of the group
 * integration with a security consequence, so it stays provable without a
 * network, a database or a set of credentials.
 */

/** Breaks the mention pattern while leaving the text readable. */
export function escapeMentions(text: string): string {
  return text.replace(/\[@/g, "[ @");
}
