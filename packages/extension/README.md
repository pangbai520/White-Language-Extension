# White Language VSCode Extension

Visual Studio Code support for **White Language** (`.wl`). 

This extension implements the Language Server Protocol (LSP) to support the [White Language](https://github.com/pangbai520/White-Language) Stage 1 self-hosting compiler. It provides code navigation, semantic highlighting, and integrated build tools for WL development.

## Key Features

* **OOP & ARC Navigation:** Supports class hierarchy tracking, VTable method dispatch, and ARC-related symbols (`init`/`deinit`).
* **Semantic Highlighting:** Accurate coloring for multi-level pointers (`ptr*2`), generics, and namespaces.
* **Formatter:** Automatic indentation for class bodies, `extern` blocks, and long struct definitions (5+ fields).
* **Module Resolution:** `Ctrl+Click` to jump to source for standard library (`std/`) and package entries (`_pkg.wl`).
* **Intelligent Tooling:** Context-aware completion, signature help for function parameters, and symbol outline.
* **Diagnostics:** Real-time syntax and type checking.
* **Quick Run:** Click the `▶` button in the editor title bar to compile and run the current file.

## Requirements

To get the most out of this extension, you'll need:

* **White Language Compiler:** `wlc` (v0.1+) must be installed and added to your **PATH**.
* **VS Code:** `v1.75.0` or newer (required for semantic highlighting).

## Quick Start

1. Install the extension in Visual Studio Code.
2. Open any `.wl` file.
3. Ensure the White Language Compiler (`wlc` / `wlc.exe`) is accessible in your system's **PATH**.
4. Start writing code or click the **Run** button in the top-right corner to compile and execute your program instantly.

## Snippets Included

The extension comes bundled with standard snippets to accelerate your workflow. Simply type the prefix and press `Tab`:

* `class` — Generates an OOP class template with `init` and `deinit`.
* `method` — Generates a class method declaration.
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
```