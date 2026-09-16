import { snippetCompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

export interface SnippetItem {
  trigger: string;
  name: string;
  detail: string;
  template: string;
  languages?: string[];
}

export const SNIPPETS: SnippetItem[] = [
  // HTML Boilerplates & Helpers
  {
    trigger: '!html5',
    name: '!html5',
    detail: 'HTML5 Starter Boilerplate',
    template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${1:Document}</title>
</head>
<body>
  \${0}
</body>
</html>`,
    languages: ['HTML', 'Markdown', 'XML', 'Plain Text']
  },
  {
    trigger: '!',
    name: '!',
    detail: 'HTML5 Boilerplate (Emmet abbreviation)',
    template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${1:Document}</title>
</head>
<body>
  \${0}
</body>
</html>`,
    languages: ['HTML', 'Markdown', 'XML', 'Plain Text']
  },
  {
    trigger: 'html:5',
    name: 'html:5',
    detail: 'HTML5 Boilerplate (Emmet)',
    template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${1:Document}</title>
</head>
<body>
  \${0}
</body>
</html>`,
    languages: ['HTML', 'Markdown', 'XML', 'Plain Text']
  },
  {
    trigger: 'link:css',
    name: 'link:css',
    detail: 'Link external CSS stylesheet',
    template: '<link rel="stylesheet" href="${1:style.css}">',
    languages: ['HTML', 'XML']
  },
  {
    trigger: 'script:src',
    name: 'script:src',
    detail: 'Script tag with external src',
    template: '<script src="${1:app.js}"></script>',
    languages: ['HTML', 'XML']
  },
  {
    trigger: 'meta:vp',
    name: 'meta:vp',
    detail: 'Responsive viewport meta tag',
    template: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    languages: ['HTML', 'XML']
  },

  // JavaScript / TypeScript / React
  {
    trigger: 'rafce',
    name: 'rafce',
    detail: 'React Arrow Function Component with Export',
    template: `import React from 'react';

export const \${1:ComponentName}: React.FC = () => {
  return (
    <div>
      \${0:\${1:ComponentName}}
    </div>
  );
};

export default \${1:ComponentName};`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'rfc',
    name: 'rfc',
    detail: 'React Function Component',
    template: `import React from 'react';

export default function \${1:ComponentName}() {
  return (
    <div>
      \${0:\${1:ComponentName}}
    </div>
  );
}`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'clg',
    name: 'clg',
    detail: 'console.log statement',
    template: "console.log('\${1:label}', \${2:value});",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'cw',
    name: 'cw',
    detail: 'console.warn statement',
    template: "console.warn('\${1:warning}');",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'ce',
    name: 'ce',
    detail: 'console.error statement',
    template: "console.error('\${1:error}');",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'fn',
    name: 'fn',
    detail: 'Named function declaration',
    template: `function \${1:name}(\${2:params}) {
  \${0}
}`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'afn',
    name: 'afn',
    detail: 'Arrow function expression',
    template: `const \${1:name} = (\${2:params}) => {
  \${0}
};`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'afna',
    name: 'afna',
    detail: 'Async arrow function expression',
    template: `const \${1:name} = async (\${2:params}) => {
  \${0}
};`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'trycatch',
    name: 'trycatch',
    detail: 'Try-catch block',
    template: `try {
  \${1}
} catch (\${2:err}) {
  \${0:console.error(\${2:err});}
}`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'prom',
    name: 'prom',
    detail: 'New Promise construct',
    template: `new Promise((resolve, reject) => {
  \${0}
});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'ues',
    name: 'ues',
    detail: 'React useEffect Hook',
    template: `useEffect(() => {
  \${1}
}, [\${2}]);`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'ust',
    name: 'ust',
    detail: 'React useState Hook',
    template: `const [\${1:state}, set\${2:State}] = useState(\${3:initialState});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'imp',
    name: 'imp',
    detail: 'ES6 Import statement',
    template: "import { \${2:member} } from '\${1:module}';",
    languages: ['JavaScript', 'TypeScript']
  },

  // Python
  {
    trigger: 'main',
    name: 'main',
    detail: 'Python __main__ boilerplate',
    template: `if __name__ == '__main__':
    \${0:main()}`,
    languages: ['Python']
  },
  {
    trigger: 'def',
    name: 'def',
    detail: 'Python function definition',
    template: `def \${1:func_name}(\${2:args}):
    \"\"\"\${3:Docstring}\"\"\"
    \${0:pass}`,
    languages: ['Python']
  },
  {
    trigger: 'adef',
    name: 'adef',
    detail: 'Python async function definition',
    template: `async def \${1:func_name}(\${2:args}):
    \${0:pass}`,
    languages: ['Python']
  },
  {
    trigger: 'class',
    name: 'class',
    detail: 'Python class definition with constructor',
    template: `class \${1:ClassName}:
    def __init__(self\${2:, args}):
        \${0:pass}`,
    languages: ['Python']
  },
  {
    trigger: 'try',
    name: 'try',
    detail: 'Python try-except block',
    template: `try:
    \${1:pass}
except \${2:Exception} as \${3:e}:
    \${0:pass}`,
    languages: ['Python']
  },

  // C / C++
  {
    trigger: 'main',
    name: 'main',
    detail: 'C/C++ main entrypoint',
    template: `#include <iostream>

int main(int argc, char* argv[]) {
    \${0:std::cout << "Hello, World!" << std::endl;}
    return 0;
}`,
    languages: ['C++', 'C', 'Arduino']
  },
  {
    trigger: 'cout',
    name: 'cout',
    detail: 'std::cout statement',
    template: 'std::cout << \${1} << std::endl;',
    languages: ['C++']
  },
  {
    trigger: 'inc',
    name: 'inc',
    detail: '#include system header',
    template: '#include <\${1:iostream}>',
    languages: ['C++', 'C']
  },

  // Rust
  {
    trigger: 'main',
    name: 'main',
    detail: 'Rust fn main boilerplate',
    template: `fn main() {
    \${0:println!("Hello, world!");}
}`,
    languages: ['Rust']
  },
  {
    trigger: 'pln',
    name: 'pln',
    detail: 'println! macro',
    template: 'println!("\${1}", \${2});',
    languages: ['Rust']
  },
  {
    trigger: 'fn',
    name: 'fn',
    detail: 'Rust function declaration',
    template: `fn \${1:name}(\${2:params}) -> \${3:()} {
    \${0}
}`,
    languages: ['Rust']
  },

  // Go
  {
    trigger: 'main',
    name: 'main',
    detail: 'Go package main boilerplate',
    template: `package main

import "fmt"

func main() {
    fmt.Println("\${0:Hello, World!}")
}`,
    languages: ['Go']
  },
  {
    trigger: 'fp',
    name: 'fp',
    detail: 'fmt.Println statement',
    template: 'fmt.Println(\${1})',
    languages: ['Go']
  },

  // CSS
  {
    trigger: 'flex',
    name: 'flex',
    detail: 'CSS Flexbox container',
    template: `display: flex;
align-items: center;
justify-content: center;`,
    languages: ['CSS']
  },
  {
    trigger: 'grid',
    name: 'grid',
    detail: 'CSS Grid responsive layout',
    template: `display: grid;
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
gap: 1rem;`,
    languages: ['CSS']
  },
  {
    trigger: 'reset',
    name: 'reset',
    detail: 'Modern CSS box-sizing reset',
    template: `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}`,
    languages: ['CSS']
  },
  // PHP Templates & Helpers
  {
    trigger: 'php',
    name: 'php',
    detail: 'PHP Opening Tag',
    template: `<?php\n\n\${0}`,
    languages: ['PHP']
  },
  {
    trigger: 'phpclass',
    name: 'phpclass',
    detail: 'PHP 8+ Strict Class Boilerplate',
    template: `<?php\n\ndeclare(strict_types=1);\n\nnamespace \${1:App};\n\nclass \${2:ClassName} {\n  public function __construct(\n    \${3}\n  ) {}\n\n  \${0}\n}`,
    languages: ['PHP']
  },
  {
    trigger: 'phpfn',
    name: 'phpfn',
    detail: 'PHP Function Definition',
    template: `function \${1:functionName}(\${2:\$params}): \${3:void} {\n  \${0}\n}`,
    languages: ['PHP']
  },
  {
    trigger: 'foreach',
    name: 'foreach',
    detail: 'PHP Foreach Loop',
    template: `foreach (\${1:\$items} as \${2:\$item}) {\n  \${0}\n}`,
    languages: ['PHP']
  }
];

export function createSnippetCompletionSource(currentLanguage?: string) {
  const completions: Completion[] = SNIPPETS.map(snip => {
    return snippetCompletion(snip.template, {
      label: snip.trigger,
      detail: snip.detail,
      type: 'keyword',
      boost: snip.trigger.startsWith('!') || snip.trigger === 'main' || snip.trigger === 'rafce' ? 99 : 50
    });
  });

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[a-zA-Z0-9:!_-]+/);
    if (!word && !context.explicit) return null;

    const query = word ? word.text.toLowerCase() : '';
    const filtered = completions.filter(c => {
      if (!query) return true;
      return c.label.toLowerCase().startsWith(query) || c.detail?.toLowerCase().includes(query);
    });

    if (filtered.length === 0) return null;

    return {
      from: word ? word.from : context.pos,
      options: filtered,
      filter: false
    };
  };
}
