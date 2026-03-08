import { AstUtils, type AstNode } from 'langium';
import { AbstractSignatureHelpProvider } from 'langium/lsp';
import type { SignatureHelp, SignatureInformation, ParameterInformation } from 'vscode-languageserver';
import * as ast from './generated/ast.js';


export class WhiteLanguageSignatureHelpProvider extends AbstractSignatureHelpProvider {
    
    protected override getSignatureFromElement(node: AstNode): SignatureHelp | undefined {
        const funcCall = AstUtils.getContainerOfType(node, ast.isFunctionCall);
        if (!funcCall) return undefined;
        const caller = funcCall.caller;
        if (!ast.isReference(caller)) return undefined;

        let decl = caller.ref?.ref;
        if (ast.isSymbolImport(decl)) {
            decl = decl.importedElement?.ref;
        }
        if (!ast.isFunctionDecl(decl) && !ast.isExternFuncDecl(decl)) return undefined;
        const paramsInfo: ParameterInformation[] = decl.params.map(p => {
            const isPtrStr = p.isPtr ? `ptr${p.ptrLevel ? '*' + p.ptrLevel : ''} ` : '';
            const typeStr = p.type ? p.type.$cstNode?.text : 'Unknown';
            return { label: `${p.name} -> ${isPtrStr}${typeStr}` };
        });
        const paramStrings = paramsInfo.map(p => p.label as string).join(', ');
        const varArgs = decl.varArgs ? (paramStrings.length > 0 ? ', ...' : '...') : '';
        const retType = decl.returnType ? decl.returnType.$cstNode?.text : 'Void';
        const signatureLabel = `${decl.name}(${paramStrings}${varArgs}) -> ${retType}`;

        const signature: SignatureInformation = {
            label: signatureLabel,
            parameters: paramsInfo
        };
        let activeParam = 0;
        if (funcCall.args) {
            activeParam = Math.max(0, funcCall.args.length - 1);
        }

        return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: activeParam
        };
    }
}