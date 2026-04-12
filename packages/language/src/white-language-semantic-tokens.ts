import { type AstNode } from 'langium';
import { AbstractSemanticTokenProvider, type SemanticTokenAcceptor } from 'langium/lsp';
import { SemanticTokenTypes, SemanticTokenModifiers } from 'vscode-languageserver-protocol';
import * as ast from './generated/ast.js';
import { type WhiteLanguageServices } from './white-language-module.js';
import { WhiteLanguageScopeProvider } from './white-language-scope-provider.js';

export class WhiteLanguageSemanticTokenProvider extends AbstractSemanticTokenProvider {
    private scopeProvider: WhiteLanguageScopeProvider;

    constructor(services: WhiteLanguageServices) {
        super(services);
        this.scopeProvider = services.references.ScopeProvider as WhiteLanguageScopeProvider;
    }

    protected override highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
        if (ast.isFileImport(node)) {
            if (node.name) {
                acceptor({ node, property: 'name', type: SemanticTokenTypes.class });
            }
        }
        else if (ast.isSymbolImport(node)) {
            const ref = node.importedElement?.ref;
            if (ref) {
                this.highlightDeclarationType(node, 'importedElement', ref, acceptor);
            }
            if (node.name) {
                acceptor({ node, property: 'name', type: SemanticTokenTypes.variable });
            }
        }
        else if (ast.isForVarDecl(node)) {
            if (node.isPtr) this.highlightPtr(node, acceptor);
            acceptor({ node, property: 'name', type: SemanticTokenTypes.variable });
        }
        else if (ast.isVariableDecl(node)) {
            if (node.isPtr) this.highlightPtr(node, acceptor);
            const modifiers = node.kind === 'const' ? [SemanticTokenModifiers.readonly] : [];
            acceptor({ node, property: 'name', type: SemanticTokenTypes.variable, modifier: modifiers });
        }
        else if (ast.isParam(node)) {
            if (node.isPtr) this.highlightPtr(node, acceptor);
            const type = ast.isStructDecl(node.$container) ? SemanticTokenTypes.property : SemanticTokenTypes.parameter;
            acceptor({ node, property: 'name', type: type });
        }
        else if (ast.isStructDecl(node) || ast.isClassDecl(node)) {
            acceptor({ node, property: 'name', type: SemanticTokenTypes.class });
            if (ast.isClassDecl(node) && node.superClass) {
                acceptor({ node, property: 'superClass', type: SemanticTokenTypes.class });
            }
        }
        else if (ast.isClassField(node)) {
            if (node.isPtr) this.highlightPtr(node, acceptor);
            const modifiers = node.kind === 'const' ? [SemanticTokenModifiers.readonly] : [];
            acceptor({ node, property: 'name', type: SemanticTokenTypes.property, modifier: modifiers });
        }
        else if (ast.isTypeExtension(node)) {
            this.highlightKeywordOrValue(node, 'type', acceptor);
        }
        else if (ast.isClassMethod(node)) {
            this.highlightKeywordOrValue(node, 'method', acceptor);
            acceptor({ node, property: 'name', type: SemanticTokenTypes.method });
        }
        else if (ast.isClassInit(node) || ast.isClassDeinit(node)) {
            acceptor({ node, property: 'name', type: SemanticTokenTypes.method });
        }
        else if (ast.isFunctionDecl(node) || ast.isExternFuncDecl(node)) {
            acceptor({ node, property: 'name', type: SemanticTokenTypes.function });
        }
        else if (ast.isReference(node)) {
            const crossRef = node.ref;
            if (!crossRef) return;
            
            let ref = crossRef.ref;
            if (!ref) return;

            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }

            if (ref) {
                if (ast.isFileImport(ref)) {
                    acceptor({ node, property: 'ref', type: SemanticTokenTypes.class });
                } else {
                    this.highlightDeclarationType(node, 'ref', ref, acceptor);
                }
            }
        }
        else if (ast.isMemberAccess(node)) {
            this.highlightMemberAccess(node, acceptor);
        }
        else if (ast.isArgument(node)) {
            if (node.name) {
                acceptor({ node, property: 'name', type: SemanticTokenTypes.parameter });
            }
        }
        else if (ast.isPointerType(node)) {
            this.highlightKeywordOrValue(node, 'ptr', acceptor);
            if (node.level !== undefined) {
                this.highlightKeywordOrValue(node, node.level.toString(), acceptor, SemanticTokenTypes.number);
            }
        }
        else if (ast.isPrimitiveType(node)) {
            acceptor({ node, property: 'name', type: SemanticTokenTypes.type });
        }
        else if (ast.isNamedType(node)) {
            const crossRef = node.ref;
            if (crossRef) {
                let ref = crossRef.ref;
                if (ast.isSymbolImport(ref)) ref = ref.importedElement?.ref;
                acceptor({ node, property: 'ref', type: SemanticTokenTypes.class });
            }
        }
        else if (ast.isVectorType(node)) {
            this.highlightKeywordOrValue(node, 'Vector', acceptor, SemanticTokenTypes.type);
        }
        else if (ast.isFunctionType(node)) {
            this.highlightKeywordOrValue(node, 'Function', acceptor, SemanticTokenTypes.type);
        }
        else if (ast.isMethodType(node)) {
            this.highlightKeywordOrValue(node, 'Method', acceptor, SemanticTokenTypes.type);
        }
        else if (ast.isLiteral(node)) {
            const text = node.$cstNode?.text;
            if (text === 'true' || text === 'false' || text === 'null' || text === 'nullptr') {
                acceptor({ node, property: 'value', type: SemanticTokenTypes.keyword });
            } else if (/^[0-9]/.test(text || '')) {
                acceptor({ node, property: 'value', type: SemanticTokenTypes.number });
            }
        }
        else if (ast.isThisExpression(node)) {
            const cst = this.findCstByText(node.$cstNode, 'this');
            if (cst) acceptor({ cst, type: SemanticTokenTypes.keyword });
        }
        else if (ast.isSelfExpression(node)) {
            const cst = this.findCstByText(node.$cstNode, 'self');
            if (cst) acceptor({ cst, type: SemanticTokenTypes.keyword });
        }
        else if (ast.isSuperExpression(node)) {
            const cst = this.findCstByText(node.$cstNode, 'super');
            if (cst) acceptor({ cst, type: SemanticTokenTypes.keyword });
        }
        else if (ast.isDerefExpression(node)) {
            this.highlightKeywordOrValue(node, 'deref', acceptor);
            if (node.level) {
                 this.highlightKeywordOrValue(node, node.level.toString(), acceptor, SemanticTokenTypes.number);
            }
        }
        else if (ast.isUnaryExpression(node) && node.op === 'ref') {
            this.highlightKeywordOrValue(node, 'ref', acceptor);
        }
    }

    private highlightMemberAccess(node: ast.MemberAccess, acceptor: SemanticTokenAcceptor) {
        const receiver = node.receiver;

        if (ast.isReference(receiver)) {
            let ref = receiver.ref?.ref;
            if (ast.isSymbolImport(ref)) ref = ref.importedElement?.ref;
            
            if (ast.isFileImport(ref)) {
                const scope = this.scopeProvider.getScopeFromImportedFile(ref);
                const element = scope.getElement(node.member);
                if (element) {
                    const typeName = element.type;
                    if (typeName.endsWith('FunctionDecl') || typeName.endsWith('ExternFuncDecl') || typeName.endsWith('ClassMethod')) {
                        acceptor({ node, property: 'member', type: SemanticTokenTypes.function });
                    } else if (typeName.endsWith('StructDecl') || typeName.endsWith('ClassDecl')) {
                        acceptor({ node, property: 'member', type: SemanticTokenTypes.class });
                    } else {
                        acceptor({ node, property: 'member', type: SemanticTokenTypes.property });
                    }
                    return;
                }
            }
        }

        const def = (this.scopeProvider as any).inferStructOrClassType(receiver) as ast.StructDecl | ast.ClassDecl | undefined;
        if (def) {
            const members = 'fields' in def ? def.fields : def.members;
            const field = members.find((f: any) => f.name === node.member);
            if (field) {
                if (ast.isClassMethod(field) || ast.isClassInit(field) || ast.isClassDeinit(field) || ast.isFunctionType((field as any).type) || ast.isMethodType((field as any).type)) {
                    acceptor({ node, property: 'member', type: SemanticTokenTypes.function });
                } else {
                    acceptor({ node, property: 'member', type: SemanticTokenTypes.property });
                }
                return;
            }
        }

        if (ast.isFunctionCall(node.$container) && node.$container.caller === node) {
            acceptor({ node, property: 'member', type: SemanticTokenTypes.function });
        } else {
            acceptor({ node, property: 'member', type: SemanticTokenTypes.property });
        }
    }

    private highlightDeclarationType(node: AstNode, property: string, ref: ast.Declaration, acceptor: SemanticTokenAcceptor) {
        if (ast.isStructDecl(ref) || ast.isClassDecl(ref)) {
            acceptor({ node, property, type: SemanticTokenTypes.class });
        } else if (ast.isFunctionDecl(ref) || ast.isExternFuncDecl(ref) || ast.isClassMethod(ref)) {
            acceptor({ node, property, type: SemanticTokenTypes.function });
        } else if (ast.isVariableDecl(ref) || ast.isClassField(ref)) {
            const modifiers = ref.kind === 'const' ? [SemanticTokenModifiers.readonly] : [];
            acceptor({ node, property, type: SemanticTokenTypes.variable, modifier: modifiers });
        } else {
            acceptor({ node, property, type: SemanticTokenTypes.variable });
        }
    }

    private highlightPtr(node: ast.VariableDecl | ast.ForVarDecl | ast.Param | ast.ClassField, acceptor: SemanticTokenAcceptor) {
        this.highlightKeywordOrValue(node, 'ptr', acceptor);
        if (node.ptrLevel !== undefined) {
            this.highlightKeywordOrValue(node, node.ptrLevel.toString(), acceptor, SemanticTokenTypes.number);
        }
    }

    private highlightKeywordOrValue(node: AstNode, text: string, acceptor: SemanticTokenAcceptor, type: string = SemanticTokenTypes.keyword): void {
        const cst = this.findCstByText(node.$cstNode, text);
        if (cst) acceptor({ cst, type });
    }
    
    private findCstByText(cst: any, text: string): any {
        if (!cst) return null;
        if (cst.text === text) return cst;
        if (cst.children) {
            for (const child of cst.children) {
                const found = this.findCstByText(child, text);
                if (found) return found;
            }
        }
        return null;
    }
}