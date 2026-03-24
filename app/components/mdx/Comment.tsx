/**
 * Comment — MDX block that is never rendered in the output.
 *
 * Usage in MDX:
 *   <Comment>
 *     Any MDX content here, including custom components.
 *     This is purely for author notes and is invisible to readers.
 *   </Comment>
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Comment(_: { children?: React.ReactNode }) {
  return null;
}
