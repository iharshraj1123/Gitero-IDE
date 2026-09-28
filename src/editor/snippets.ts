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
  {
    trigger: 'class',
    name: 'class',
    detail: 'JavaScript / TypeScript Class definition',
    template: `class \${1:ClassName} {
  constructor(\${2:params}) {
    \${0}
  }
}`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'setTimeout',
    name: 'setTimeout',
    detail: 'setTimeout with arrow callback',
    template: `setTimeout(() => {
  \${0}
}, \${1:1000});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'sto',
    name: 'sto',
    detail: 'setTimeout shorthand',
    template: `setTimeout(() => {
  \${0}
}, \${1:1000});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'setInterval',
    name: 'setInterval',
    detail: 'setInterval with arrow callback',
    template: `setInterval(() => {
  \${0}
}, \${1:1000});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'sti',
    name: 'sti',
    detail: 'setInterval shorthand',
    template: `setInterval(() => {
  \${0}
}, \${1:1000});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'setImmediate',
    name: 'setImmediate',
    detail: 'setImmediate callback',
    template: `setImmediate(() => {
  \${0}
});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'raf',
    name: 'raf',
    detail: 'requestAnimationFrame callback',
    template: `requestAnimationFrame((\${1:timestamp}) => {
  \${0}
});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'addEventListener',
    name: 'addEventListener',
    detail: 'DOM addEventListener with arrow callback',
    template: `addEventListener('\${1:click}', (\${2:event}) => {
  \${0}
});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'ael',
    name: 'ael',
    detail: 'addEventListener shorthand',
    template: `addEventListener('\${1:click}', (\${2:event}) => {
  \${0}
});`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'removeEventListener',
    name: 'removeEventListener',
    detail: 'DOM removeEventListener',
    template: "removeEventListener('\${1:click}', \${2:listener});",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'fetch',
    name: 'fetch',
    detail: 'fetch() Promise chain',
    template: `fetch('\${1:url}')
  .then((\${2:res}) => \${2:res}.json())
  .then((\${3:data}) => {
    \${0}
  });`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'afetch',
    name: 'afetch',
    detail: 'async await fetch()',
    template: `const \${1:res} = await fetch('\${2:url}');
const \${3:data} = await \${1:res}.json();
\${0}`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'qs',
    name: 'qs',
    detail: 'document.querySelector shorthand',
    template: "document.querySelector('\${1:selector}')",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'qsa',
    name: 'qsa',
    detail: 'document.querySelectorAll shorthand',
    template: "document.querySelectorAll('\${1:selector}')",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'gi',
    name: 'gi',
    detail: 'document.getElementById shorthand',
    template: "document.getElementById('\${1:id}')",
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'iife',
    name: 'iife',
    detail: 'Immediately Invoked Function Expression (Arrow)',
    template: `(() => {
  \${0}
})();`,
    languages: ['JavaScript', 'TypeScript']
  },
  {
    trigger: 'aiife',
    name: 'aiife',
    detail: 'Async Immediately Invoked Function Expression',
    template: `(async () => {
  \${0}
})();`,
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
  {
    trigger: 'with',
    name: 'with',
    detail: 'Python with open statement',
    template: `with open('\${1:filename}', '\${2:r}', encoding='utf-8') as \${3:f}:
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
  {
    trigger: 'match',
    name: 'match',
    detail: 'Rust match expression',
    template: `match \${1:expr} {
    Ok(\${2:val}) => \${0},
    Err(\${3:err}) => {},
}`,
    languages: ['Rust']
  },
  {
    trigger: 'iflet',
    name: 'iflet',
    detail: 'Rust if let Some expression',
    template: `if let Some(\${1:val}) = \${2:opt} {
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
  {
    trigger: 'ife',
    name: 'ife',
    detail: 'Go if err != nil check',
    template: `if err != nil {
\treturn \${1:nil}, \${2:err}
}`,
    languages: ['Go']
  },
  {
    trigger: 'hf',
    name: 'hf',
    detail: 'Go http.HandleFunc',
    template: `http.HandleFunc("\${1:/path}", func(w http.ResponseWriter, r *http.Request) {
\t\${0}
})`,
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
  },

  // Java Templates & Helpers
  {
    trigger: 'psvm',
    name: 'psvm',
    detail: 'public static void main(String[] args)',
    template: `public static void main(String[] args) {\n  \${0}\n}`,
    languages: ['Java']
  },
  {
    trigger: 'main',
    name: 'main',
    detail: 'public static void main entry point',
    template: `public static void main(String[] args) {\n  \${0}\n}`,
    languages: ['Java']
  },
  {
    trigger: 'sout',
    name: 'sout',
    detail: 'System.out.println()',
    template: 'System.out.println(${1});',
    languages: ['Java']
  },
  {
    trigger: 'serr',
    name: 'serr',
    detail: 'System.err.println()',
    template: 'System.err.println(${1});',
    languages: ['Java']
  },
  {
    trigger: 'class',
    name: 'class',
    detail: 'Java Class declaration',
    template: `public class \${1:ClassName} {\n  public \${1:ClassName}() {\n    \${0}\n  }\n}`,
    languages: ['Java']
  },
  {
    trigger: 'interface',
    name: 'interface',
    detail: 'Java Interface declaration',
    template: `public interface \${1:InterfaceName} {\n  \${0}\n}`,
    languages: ['Java']
  },
  {
    trigger: 'record',
    name: 'record',
    detail: 'Java Record declaration (Java 16+)',
    template: `public record \${1:RecordName}(\${2}) {\n  \${0}\n}`,
    languages: ['Java']
  },
  {
    trigger: 'trycatch',
    name: 'trycatch',
    detail: 'try-catch block',
    template: `try {\n  \${1}\n} catch (\${2:Exception} e) {\n  e.printStackTrace();\n}`,
    languages: ['Java', 'C#']
  },
  {
    trigger: 'activity',
    name: 'activity',
    detail: 'Android AppCompatActivity (Java)',
    template: `package \${1:com.example.app};

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

public class \${2:MainActivity} extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.\${3:activity_main});
        \${0}
    }
}`,
    languages: ['Java']
  },

  // Kotlin & Android Templates & Helpers
  {
    trigger: 'main',
    name: 'main',
    detail: 'Kotlin main function entry point',
    template: `fun main(args: Array<String>) {\n  \${0}\n}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'class',
    name: 'class',
    detail: 'Kotlin Class declaration',
    template: `class \${1:ClassName} {\n  \${0}\n}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'data',
    name: 'data class',
    detail: 'Kotlin Data Class',
    template: `data class \${1:ClassName}(\n  val \${2:id}: \${3:Long},\n  val \${4:name}: \${5:String}\n)`,
    languages: ['Kotlin']
  },
  {
    trigger: 'fun',
    name: 'fun',
    detail: 'Kotlin Function declaration',
    template: `fun \${1:functionName}(\${2}): \${3:Unit} {\n  \${0}\n}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'composable',
    name: 'composable',
    detail: 'Jetpack Compose @Composable Function',
    template: `@Composable\nfun \${1:ComponentName}(modifier: Modifier = Modifier) {\n  \${0}\n}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'activity',
    name: 'activity',
    detail: 'Android ComponentActivity (Kotlin / Compose)',
    template: `package \${1:com.example.app}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface

class \${2:MainActivity} : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    \${0}
                }
            }
        }
    }
}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'viewmodel',
    name: 'viewmodel',
    detail: 'Android ViewModel with StateFlow',
    template: `package \${1:com.example.app}

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class \${2:MainViewModel} : ViewModel() {
    private val _uiState = MutableStateFlow(\${3:initialState})
    val uiState: StateFlow<\${4:UiState}> = _uiState.asStateFlow()
    \${0}
}`,
    languages: ['Kotlin']
  },
  {
    trigger: 'launch',
    name: 'launch',
    detail: 'Kotlin Coroutine launch block',
    template: `CoroutineScope(Dispatchers.\${1:IO}).launch {\n  \${0}\n}`,
    languages: ['Kotlin']
  },

  // Dart & Flutter Templates & Helpers
  {
    trigger: 'main',
    name: 'main',
    detail: 'Flutter main() runApp entry point',
    template: `void main() {\n  runApp(const \${1:MyApp}());\n}`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'stless',
    name: 'stless',
    detail: 'Flutter StatelessWidget Boilerplate',
    template: `import 'package:flutter/material.dart';

class \${1:MyWidget} extends StatelessWidget {
  const \${1:MyWidget}({super.key});

  @override
  Widget build(BuildContext context) {
    return const \${2:Placeholder()};
  }
}`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'stful',
    name: 'stful',
    detail: 'Flutter StatefulWidget Boilerplate',
    template: `import 'package:flutter/material.dart';

class \${1:MyWidget} extends StatefulWidget {
  const \${1:MyWidget}({super.key});

  @override
  State<\${1:MyWidget}> createState() => _\${1:MyWidget}State();
}

class _\${1:MyWidget}State extends State<\${1:MyWidget}> {
  @override
  Widget build(BuildContext context) {
    return const \${2:Placeholder()};
  }
}`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'scaffold',
    name: 'scaffold',
    detail: 'Flutter Scaffold with AppBar and Body',
    template: `Scaffold(
  appBar: AppBar(
    title: const Text('\${1:Title}'),
  ),
  body: \${2:Center(
    child: Text('\${3:Hello World}'),
  )},
)`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'column',
    name: 'column',
    detail: 'Flutter Column widget',
    template: `Column(
  mainAxisAlignment: MainAxisAlignment.\${1:center},
  children: [
    \${0},
  ],
)`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'row',
    name: 'row',
    detail: 'Flutter Row widget',
    template: `Row(
  mainAxisAlignment: MainAxisAlignment.\${1:center},
  children: [
    \${0},
  ],
)`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'container',
    name: 'container',
    detail: 'Flutter Container widget',
    template: `Container(
  padding: const EdgeInsets.all(\${1:16.0}),
  child: \${0},
)`,
    languages: ['Dart', 'Dart / Flutter']
  },
  {
    trigger: 'setstate',
    name: 'setState',
    detail: 'Flutter setState(() { ... }) call',
    template: `setState(() {\n  \${0}\n});`,
    languages: ['Dart', 'Dart / Flutter']
  },

  // Android XML Boilerplates
  {
    trigger: 'manifest',
    name: 'manifest',
    detail: 'Android AndroidManifest.xml skeleton',
    template: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.\${1:MyApp}">
        <activity
            android:name=".\${2:MainActivity}"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`,
    languages: ['XML']
  },
  {
    trigger: 'layout-constraint',
    name: 'layout-constraint',
    detail: 'Android ConstraintLayout XML',
    template: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    \${0}

</androidx.constraintlayout.widget.ConstraintLayout>`,
    languages: ['XML']
  },
  {
    trigger: 'layout-linear',
    name: 'layout-linear',
    detail: 'Android LinearLayout XML',
    template: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="\${1:vertical}">

    \${0}

</LinearLayout>`,
    languages: ['XML']
  },
  {
    trigger: 'textview',
    name: 'textview',
    detail: 'Android TextView XML element',
    template: `<TextView
    android:id="@+id/\${1:textView}"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="\${2:Hello World}" />`,
    languages: ['XML']
  },
  {
    trigger: 'button',
    name: 'button',
    detail: 'Android MaterialButton XML element',
    template: `<com.google.android.material.button.MaterialButton
    android:id="@+id/\${1:button}"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="\${2:Click Me}" />`,
    languages: ['XML']
  },
  {
    trigger: 'strings-xml',
    name: 'strings-xml',
    detail: 'Android strings.xml resource file',
    template: `<resources>
    <string name="app_name">\${1:MyApp}</string>
    \${0}
</resources>`,
    languages: ['XML']
  },

  // Gradle / Groovy Boilerplates
  {
    trigger: 'android-app',
    name: 'android-app',
    detail: 'Android Application build.gradle template',
    template: `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '\${1:com.example.app}'
    compileSdk 34

    defaultConfig {
        applicationId "\${1:com.example.app}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    \${0}
}`,
    languages: ['Groovy', 'Groovy / Gradle']
  },
  {
    trigger: 'deps',
    name: 'dependencies',
    detail: 'Gradle dependencies block',
    template: `dependencies {\n    implementation '\${1:group:artifact:version}'\n    \${0}\n}`,
    languages: ['Groovy', 'Groovy / Gradle']
  },

  // C# Templates & Helpers
  {
    trigger: 'cw',
    name: 'cw',
    detail: 'Console.WriteLine()',
    template: 'Console.WriteLine(${1});',
    languages: ['C#']
  },
  {
    trigger: 'class',
    name: 'class',
    detail: 'C# Class declaration',
    template: `public class \${1:ClassName}\n{\n    public \${1:ClassName}()\n    {\n        \${0}\n    }\n}`,
    languages: ['C#']
  },
  {
    trigger: 'prop',
    name: 'prop',
    detail: 'C# Auto-implemented Property',
    template: 'public ${1:string} ${2:MyProperty} { get; set; }',
    languages: ['C#']
  },
  {
    trigger: 'propg',
    name: 'propg',
    detail: 'C# Property with private setter',
    template: 'public ${1:string} ${2:MyProperty} { get; private set; }',
    languages: ['C#']
  },
  {
    trigger: 'interface',
    name: 'interface',
    detail: 'C# Interface declaration',
    template: `public interface I\${1:InterfaceName}\n{\n    \${0}\n}`,
    languages: ['C#']
  },
  {
    trigger: 'record',
    name: 'record',
    detail: 'C# Record declaration',
    template: 'public record ${1:RecordName}(${2});',
    languages: ['C#']
  },
  {
    trigger: 'main',
    name: 'main',
    detail: 'C# async Task Main entry point',
    template: `public static async Task Main(string[] args)\n{\n    \${0}\n}`,
    languages: ['C#']
  }
];

export function isSnippetApplicable(snippetLanguages: string[] | undefined, targetLanguageIdOrName: string): boolean {
  if (!snippetLanguages || snippetLanguages.length === 0) {
    return true; // Global snippet applicable everywhere
  }
  if (!targetLanguageIdOrName) {
    return false;
  }

  const target = targetLanguageIdOrName.toLowerCase().trim();

  // Normalize target language ID to standard aliases
  const targetAliases = new Set<string>([target]);
  if (target === 'javascript' || target === 'js') {
    targetAliases.add('javascript');
    targetAliases.add('js');
  } else if (target === 'typescript' || target === 'ts') {
    targetAliases.add('typescript');
    targetAliases.add('ts');
    targetAliases.add('javascript'); // TypeScript supports standard JavaScript snippets
    targetAliases.add('js');
  } else if (target === 'javascriptreact' || target === 'jsx') {
    targetAliases.add('javascript');
    targetAliases.add('react');
    targetAliases.add('jsx');
  } else if (target === 'typescriptreact' || target === 'tsx') {
    targetAliases.add('typescript');
    targetAliases.add('javascript');
    targetAliases.add('react');
    targetAliases.add('tsx');
  } else if (target === 'cpp' || target === 'c++' || target === 'c') {
    targetAliases.add('cpp');
    targetAliases.add('c++');
    targetAliases.add('c');
  } else if (target === 'python' || target === 'py') {
    targetAliases.add('python');
    targetAliases.add('py');
  } else if (target === 'rust' || target === 'rs') {
    targetAliases.add('rust');
    targetAliases.add('rs');
  } else if (target === 'go' || target === 'golang') {
    targetAliases.add('go');
    targetAliases.add('golang');
  } else if (target === 'java') {
    targetAliases.add('java');
  } else if (target === 'kotlin' || target === 'kt') {
    targetAliases.add('kotlin');
    targetAliases.add('kt');
  } else if (target === 'dart' || target === 'flutter' || target.includes('dart')) {
    targetAliases.add('dart');
    targetAliases.add('flutter');
    targetAliases.add('dart / flutter');
  } else if (target === 'c#' || target === 'csharp' || target === 'cs') {
    targetAliases.add('c#');
    targetAliases.add('csharp');
    targetAliases.add('cs');
  } else if (target === 'groovy' || target === 'gradle' || target.includes('gradle')) {
    targetAliases.add('groovy');
    targetAliases.add('gradle');
    targetAliases.add('groovy / gradle');
  } else if (target === 'html' || target === 'xml') {
    targetAliases.add('html');
    targetAliases.add('xml');
  } else if (target === 'css' || target === 'scss' || target === 'less') {
    targetAliases.add('css');
    targetAliases.add('scss');
    targetAliases.add('less');
  } else if (target === 'php') {
    targetAliases.add('php');
  }

  return snippetLanguages.some((lang) => {
    const l = lang.toLowerCase().trim();
    if (targetAliases.has(l)) return true;
    if (l === 'c / c++' && (target === 'cpp' || target === 'c')) return true;
    if (l === 'c++' && (target === 'cpp' || target === 'c')) return true;
    if (l === 'plain text') return target === 'plaintext';
    return false;
  });
}

export function createSnippetCompletionSource(getLanguage?: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[a-zA-Z0-9:!_-]+/);
    if (!word && !context.explicit) return null;

    const currentLang = getLanguage ? getLanguage() : '';
    const query = word ? word.text.toLowerCase() : '';

    const applicableSnippets = currentLang
      ? SNIPPETS.filter((snip) => isSnippetApplicable(snip.languages, currentLang))
      : SNIPPETS;

    const filtered = applicableSnippets
      .filter((snip) => {
        if (!query) return true;
        return snip.trigger.toLowerCase().startsWith(query) || snip.detail?.toLowerCase().includes(query);
      })
      .map((snip) => {
        return snippetCompletion(snip.template, {
          label: snip.trigger,
          detail: snip.detail,
          type: 'keyword',
          boost: snip.trigger.startsWith('!') || snip.trigger === 'main' || snip.trigger === 'rafce' ? 99 : 50
        });
      });

    if (filtered.length === 0) return null;

    return {
      from: word ? word.from : context.pos,
      options: filtered,
      filter: false
    };
  };
}
