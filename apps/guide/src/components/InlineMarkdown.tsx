import { splitCodeSpans } from '../lib/inlineMarkdown'

/** A FHIR markdown field rendered for reading: code spans as code, the rest as text. */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {splitCodeSpans(text).map((part, i) =>
        part.kind === 'code' ? <code key={i}>{part.text}</code> : part.text,
      )}
    </>
  )
}
