import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import verilog from 'highlight.js/lib/languages/verilog'
import vhdl from 'highlight.js/lib/languages/vhdl'
import xml from 'highlight.js/lib/languages/xml'

// The languages a student is most likely to write — including the hardware
// description languages for Digital Logic. Each name's usual aliases (js,
// ts, py, sh, html, sv…) come with it.
for (const [name, language] of Object.entries({
  bash,
  c,
  cpp,
  css,
  java,
  javascript,
  json,
  markdown,
  python,
  sql,
  typescript,
  verilog,
  vhdl,
  xml,
})) {
  hljs.registerLanguage(name, language)
}

export function highlight(code: string, language: string): string | null {
  if (!hljs.getLanguage(language)) return null
  return hljs.highlight(code, { language, ignoreIllegals: true }).value
}
