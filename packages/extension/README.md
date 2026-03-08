# White Language VSCode Extension

Official Visual Studio Code language support for **White Language** (`.wl`). 

White Language is a modern, strongly-typed programming language featuring an LLVM backend and Automatic Reference Counting (ARC). This extension provides a fully-fledged Language Server Protocol (LSP) implementation, transforming VSCode into a powerful, industrial-grade IDE for White Language development. 

Designed specifically to support the [White Language](https://github.com/pangbai520/White-Language) Stage 1 self-hosting compiler, this extension offers deep code comprehension and a seamless developer experience.

## Key Features

* **Semantic Syntax Highlighting:** Goes beyond basic regular expressions. The extension thoroughly understands your AST, providing precise colors for multi-level indirection, generic functions, structs, and cross-file namespaces.
* **Intelligent Code Completion:** Context-aware suggestions. Type `.` to reveal struct fields, member functions, or imported module exports.
* **Real-time Diagnostics:** Catch errors while you type. Includes strict type checking, division-by-zero detection, unreachable code fading, and variable assignment validation.
* **Hover Information:** Simply hover your cursor over any variable, function, or struct to reveal its complete type signature and declaration details.
* **Signature Help:** Never forget a function parameter again. Typing `(` automatically triggers an inline overlay detailing the expected arguments and their types.
* **Document Outline:** Easily navigate through massive codebases (like `WhitelangCompiler.wl`) via the native VSCode outline panel, complete with custom icons for structs, functions, and `extern` interfaces.
* **One-Click Run:** Features a convenient `▶` button in the editor title bar. Click it to automatically invoke the compiler and execute the resulting binary within the integrated terminal.

## Requirements

To enable the full suite of IDE features (LSP, diagnostics, and formatting), ensure your environment meets the following criteria:

* **White Language Compiler:** Version `0.1` or higher must be installed.
* **System PATH:** The compiler binary (`wlc` or `wlc.exe`) should be accessible via your system's PATH environment variable.
* **VS Code Version:** Visual Studio Code `v1.75.0` or newer is recommended for optimal semantic highlighting performance.

## Quick Start

1. Install the extension in Visual Studio Code.
2. Open any `.wl` file.
3. Ensure the White Language Compiler (`wlc` / `wlc.exe`) is accessible in your system's **PATH**. (Tip: Try running `wlc --version` in your terminal to verify).
4. Start writing code or click the **Run** button in the top-right corner to compile and execute your program instantly.

## Snippets Included

The extension comes bundled with standard snippets to accelerate your workflow. Simply type the prefix and press `Tab`:

* `func` — Generates a function declaration template.
* `struct` — Generates a struct initialization block.
* `if` / `while` / `for` — Generates standard control flow structures.


## Building from Source

If you want to modify the extension or build it locally, follow these steps:

1. Clone the repository:
```bash
git clone https://github.com/pangbai520/White-Language-Extension.git
cd White-Language-Extension
```

2. Install the necessary dependencies:
```bash
npm install
```

3. Compile the language server and extension:
```bash
npm run langium:generate
npm run build
```

4. Press `F5` in VSCode. This will open a new **Extension Development Host** window with the White Language extension loaded and ready for debugging.

## Packaging

To generate a `.vsix` file for manual installation:

```bash
cd White-Language-Extension/packages/extension
npm run package