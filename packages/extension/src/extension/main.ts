import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    client = await startLanguageClient(context);

    context.subscriptions.push(vscode.commands.registerCommand('whitelang.run', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        editor.document.save().then(() => {
            const filePath = editor.document.fileName;
            const isWin = process.platform === 'win32';
            
            const exePath = isWin 
                ? filePath.substring(0, filePath.lastIndexOf('.')) + '.exe' 
                : filePath.substring(0, filePath.lastIndexOf('.'));

            const runCmd = isWin ? `& "${exePath}"` : `"${exePath}"`;
            
            let terminal = vscode.window.terminals.find(t => t.name === 'White Language');
            if (!terminal) {
                terminal = vscode.window.createTerminal('White Language');
            }
            
            terminal.show(); 
            terminal.sendText(`wlc "${filePath}" && ${runCmd}`);
        });
    }));
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: '*', language: 'white-language' }]
    };

    const client = new LanguageClient(
        'white-language',
        'White Language',
        serverOptions,
        clientOptions
    );

    await client.start();
    return client;
}