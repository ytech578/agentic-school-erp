/**
 * Centralized Mathematical LaTeX & Markdown Sanitizer
 * Re-used across Teacher Copilot, Question Paper Generator, Student Remedial Tutor, and Principal Sentinel.
 */

export function cleanLatexMath(latex: string): string {
  if (!latex) return "";
  let m = latex.trim();

  // Strip math delimiters like $$, \(\), \[\]
  m = m.replace(/^\$\$|\$\$$/g, "").replace(/^\\\(|\\\)$/g, "").replace(/^\\\[|\\\]$/g, "").trim();
  m = m.replace(/\\times/g, "×");
  m = m.replace(/\\cdot/g, "·");
  m = m.replace(/\\div/g, "÷");
  m = m.replace(/\\pm/g, "±");
  m = m.replace(/\\mp/g, "∓");
  m = m.replace(/\\neq/g, "≠");
  m = m.replace(/\\approx/g, "≈");
  m = m.replace(/\\leq?/g, "≤");
  m = m.replace(/\\geq?/g, "≥");
  m = m.replace(/\\infty/g, "∞");
  m = m.replace(/\\Delta/g, "Δ");
  m = m.replace(/\\delta/g, "δ");
  m = m.replace(/\\pi/g, "π");
  m = m.replace(/\\theta/g, "θ");
  m = m.replace(/\\alpha/g, "α");
  m = m.replace(/\\beta/g, "β");
  m = m.replace(/\\gamma/g, "γ");
  m = m.replace(/\\lambda/g, "λ");
  m = m.replace(/\\mu/g, "μ");
  m = m.replace(/\\sigma/g, "σ");
  m = m.replace(/\\omega/g, "ω");
  m = m.replace(/\\Sigma/g, "Σ");
  m = m.replace(/\\sum/g, "∑");
  m = m.replace(/\\degree|\^\s*\\circ/g, "°");

  // \frac{a}{b} or \dfrac{a}{b} -> (a / b)
  m = m.replace(/\\(?:d)?frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1 / $2)");

  // \sqrt{a} -> √(a)
  m = m.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");
  m = m.replace(/\\sqrt\[(\d+)\]\{([^{}]+)\}/g, "($2)^(1/$1)");

  // \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}
  m = m.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]+)\}/g, "$1");

  // Superscripts
  m = m.replace(/\^2(?!\d)/g, "²");
  m = m.replace(/\^3(?!\d)/g, "³");
  m = m.replace(/\^0(?!\d)/g, "⁰");
  m = m.replace(/\^1(?!\d)/g, "¹");
  m = m.replace(/\^\{2\}/g, "²");
  m = m.replace(/\^\{3\}/g, "³");
  m = m.replace(/\^\{([^{}]+)\}/g, "^($1)");

  // Subscripts
  m = m.replace(/_0(?!\d)/g, "₀");
  m = m.replace(/_1(?!\d)/g, "₁");
  m = m.replace(/_2(?!\d)/g, "₂");
  m = m.replace(/_3(?!\d)/g, "₃");
  m = m.replace(/_\{0\}/g, "₀");
  m = m.replace(/_\{1\}/g, "₁");
  m = m.replace(/_\{2\}/g, "₂");
  m = m.replace(/_\{([^{}]+)\}/g, "_$1");

  // Braces & grouping
  m = m.replace(/\\left\(/g, "(");
  m = m.replace(/\\right\)/g, ")");
  m = m.replace(/\\left\[/g, "[");
  m = m.replace(/\\right\]/g, "]");
  m = m.replace(/\\left\\\{/g, "{");
  m = m.replace(/\\right\\\}/g, "}");
  m = m.replace(/\\(?:quad|qquad)\s?/g, "    ");
  m = m.replace(/\\[,;!]/g, " ");
  m = m.replace(/\\(?:\s|~)/g, " ");
  m = m.replace(/\\([a-zA-Z]+)/g, "$1");

  return m;
}

export function formatCopilotMarkdown(content: string): string {
  if (!content) return "";
  let text = content.replace(/\r\n/g, "\n");

  // 1. Normalize <br>, <br/>, <br /> so rehypeRaw parses them safely without breaking Markdown tables
  text = text.replace(/<br\s*\/?>/gi, "<br />");

  // 2. Ensure clear word boundaries between question numbers and text (e.g. "Q1.Find" -> "Q1. Find")
  text = text.replace(/(Q\d+[\.:]|\b\d+[\.:])([A-Za-z])/g, "$1 $2");

  // 3. Ensure clear spacing between MCQ options and option text (e.g. "(a)Option" -> "(a) Option")
  text = text.replace(/(\([a-d]\)|[A-D]\))([A-Za-z])/gi, "$1 $2");

  // 4. Ensure spaces around inline math if immediately adjacent to alphanumeric characters
  text = text.replace(/([a-zA-Z0-9])\$([^\$\n]+?)\$/g, (_, char, math) => `${char} $${math}$`);
  text = text.replace(/\$([^\$\n]+?)\$([a-zA-Z0-9])/g, (_, math, char) => `$${math}$ ${char}`);

  // 5. Format block LaTeX equations $$ ... $$
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    return `\n\n> 📐 **Formula:** ${cleanLatexMath(math)}\n\n`;
  });

  // 6. Format inline LaTeX math $ ... $ (while preserving currency like $50 or $100)
  text = text.replace(/(?<![\w\\\$])\$([^\$\n]+?)\$(?![\w\$])/g, (match, math) => {
    if (/^\s*\d+(\.\d+)?(\s*(USD|INR|EUR|\/))?\s*$/i.test(math)) {
      return match;
    }
    return cleanLatexMath(math);
  });

  // 7. Also sanitize un-delimited LaTeX commands like \frac{...}{...} or \sqrt{...}
  text = cleanLatexMath(text);

  // 8. Ensure tables have empty line before and after so GFM table parser triggers reliably
  text = text.replace(/([^\n])\n(\|[^\n]+\|\n\|[\s:-|]+\|)/g, "$1\n\n$2");
  text = text.replace(/(\|[^\n]+\|)\n([^\n|])/g, "$1\n\n$2");

  return text;
}
