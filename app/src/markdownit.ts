import { hashCode, uniqueIdGen } from './util.ts';
import { parseArgs } from 'https://deno.land/std@0.217.0/cli/parse_args.ts';
import { default as highlight } from 'https://cdn.skypack.dev/highlight.js@11.9.0';
// @deno-types="https://esm.sh/v135/@types/markdown-it@13.0.7/index.d.ts";
import MarkdownIt from 'https://esm.sh/markdown-it@14.0.0';
import { full as MarkdownItEmoji } from 'https://esm.sh/markdown-it-emoji@3.0.0';
import { default as MarkdownItFootnote } from 'https://esm.sh/markdown-it-footnote@4.0.0';
import { default as MarkdownItTaskLists } from 'https://esm.sh/markdown-it-task-lists@2.1.1';
import { default as MarkdownItTexmath } from 'https://esm.sh/markdown-it-texmath@1.0.0';
import Katex from 'https://esm.sh/katex@0.16.9';
import MarkdownItGitHubAlerts from 'https://esm.sh/markdown-it-github-alerts@1.0.0'
// import MarkdownItTOC from 'https://esm.sh/markdown-it-table-of-contents@0.9.0'
// import MarkdownItAttrs from 'https://esm.sh/markdown-it-attrs@4.3.1'
// import MarkdownItAnchor from "https://esm.sh/markdown-it-anchor@9.2.0/deno/markdown-it-anchor.mjs";

const __args = parseArgs(Deno.args);

const md = new MarkdownIt('default', {
  html: true,
  typographer: true,
  linkify: true,
  langPrefix: 'language-',
  highlight: __args['syntax'] && ((code, language) => {
    if (language && highlight.getLanguage(language)) {
      try {
        return highlight.highlight(code, { language }).value;
      } catch {
        return code;
      }
    }

    return '';
  }),
}).use(MarkdownItEmoji)
  .use(MarkdownItGitHubAlerts)
  // .use(MarkdownItTOC)
  // .use(MarkdownItAttrs)
  // .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItTaskLists, { enabled: false, label: true })
  .use(MarkdownItTexmath, {
    engine: Katex,
    delimiters: ['gitlab', 'dollars'],
    katexOptions: {
      macros: { '\\R': '\\mathbb{R}' },
      strict: false,
      throwOnError: false,
    },
  });

md.renderer.rules.link_open = (tokens, idx, options) => {
  const token = tokens[idx];
  const href = token.attrGet('href');

  if (href && href.startsWith('#')) {
    token.attrSet('onclick', `location.hash='${href}'`);
  }

  token.attrSet('href', 'javascript:return');

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.heading_open = (tokens, idx, options) => {
  tokens[idx].attrSet(
    'id',
    tokens[idx + 1].content
      .trim()
      .split(' ')
      .filter((a) => a)
      .join('-')
      .replace(/[^a-z0-9-]/gi, '')
      .toLowerCase(),
  );

  return md.renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.math_block = (() => {
  const math_block = md.renderer.rules.math_block!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.math_block_eqno = (() => {
  const math_block_eqno = md.renderer.rules.math_block_eqno!;

  return (tokens, idx, options, env, self) => {
    return `
      <div
        data-line-begin="${tokens[idx].attrGet('data-line-begin')}"
      >
        ${math_block_eqno(tokens, idx, options, env, self)}
      </div>
    `;
  };
})();

md.renderer.rules.fence = (() => {
  const fence = md.renderer.rules.fence!;
  const escapeHtml = md.utils.escapeHtml;
  const regex = new RegExp(
    /^(?<frontmatter>---[\s\S]+---)?\s*(?<content>(?<charttype>flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram|pie|journey|C4Context|erDiagram|requirementDiagram|gitGraph)[\s\S]+)/,
  );

  return (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const content = token.content.trim();

    if (regex.test(content)) {
      const match = regex.exec(content);
      return `
        <div
          class="peek-mermaid-container"
          data-line-begin="${token.attrGet('data-line-begin')}"
        >
          <div
            id="graph-mermaid-${env.genId(hashCode(content))}"
            data-graph="mermaid"
            data-graph-definition="${escapeHtml(match?.groups?.content || '')}"
          >
            <div class="peek-loader"></div>
          </div>
        </div>
      `;
    }

    return fence(tokens, idx, options, env, self);
  };
})();

export function render(markdown: string) {
  const tokens = md.parse(markdown, {});

  tokens.forEach((token) => {
    if (token.map && token.level === 0) {
      token.attrSet('data-line-begin', String(token.map[0] + 1));
    }
  });

  return md.renderer.render(tokens, md.options, { genId: uniqueIdGen() });
}
