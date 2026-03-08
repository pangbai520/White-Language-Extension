import { type MaybePromise } from 'langium';
import { DefaultCompletionProvider, type CompletionAcceptor, type CompletionContext } from 'langium/lsp';
import { CompletionItemKind } from 'vscode-languageserver';
import * as ast from './generated/ast.js';
import type { WhiteLanguageServices } from './white-language-module.js';


export class WhiteLanguageCompletionProvider extends DefaultCompletionProvider {
    
    constructor(services: WhiteLanguageServices) {
        super(services);
    }

    protected override completionFor(context: CompletionContext, next: any, acceptor: CompletionAcceptor): MaybePromise<void> {
        if (next.feature?.name === 'member' || next.property === 'member') {
            const node = context.node;
            let receiver: ast.Expression | undefined;
            if (ast.isMemberAccess(node)) {
                receiver = node.receiver;
            } else if (node && ast.isMemberAccess(node.$container)) {
                receiver = node.$container.receiver;
            }

            if (receiver) {
                this.provideMemberCompletions(context, receiver, acceptor);
                return;
            }
        }
        return super.completionFor(context, next, acceptor);
    }

    private provideMemberCompletions(context: CompletionContext, receiver: ast.Expression, acceptor: CompletionAcceptor) {
        const myScopeProvider = this.scopeProvider as any;
        if (ast.isReference(receiver)) {
            let ref = receiver.ref?.ref;
            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }
            if (ast.isFileImport(ref)) {
                const scope = myScopeProvider.getScopeFromImportedFile(ref);
                for (const desc of scope.getAllElements()) {
                    const isFunc = desc.type.endsWith('FunctionDecl') || desc.type.endsWith('ExternFuncDecl');
                    acceptor(context, {
                        label: desc.name,
                        kind: isFunc ? CompletionItemKind.Function : CompletionItemKind.Class,
                        detail: `from ${ref.name || ref.path}`
                    });
                }
                return;
            }
        }
        const structDef = myScopeProvider.inferStructType(receiver) as ast.StructDecl | undefined;
        if (structDef) {
            for (const field of structDef.fields) {
                const isFunc = ast.isFunctionType(field.type);
                const typeStr = field.type ? field.type.$cstNode?.text : 'Unknown';
                acceptor(context, {
                    label: field.name,
                    kind: isFunc ? CompletionItemKind.Method : CompletionItemKind.Property,
                    detail: `-> ${typeStr}`
                });
            }
        }
    }
}