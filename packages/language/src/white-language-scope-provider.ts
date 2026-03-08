import { 
    DefaultScopeProvider, 
    type Scope, 
    type ReferenceInfo, 
    AstUtils,
    DefaultScopeComputation,
    type LangiumDocument,
    type AstNodeDescription,
    EMPTY_SCOPE,
    StreamScope,
    type AstNode,
} from 'langium';
import type { CancellationToken } from 'vscode-languageserver';
import { Utils } from 'vscode-uri'; 
import * as ast from './generated/ast.js';

export class WhiteLanguageScopeComputation extends DefaultScopeComputation {

    async computeExports(document: LangiumDocument, _cancelToken?: CancellationToken): Promise<AstNodeDescription[]> {
        const exportedItems: AstNodeDescription[] = [];
        const rootNode = document.parseResult.value;

        if (ast.isProgram(rootNode)) {
            for (const node of rootNode.statements) {
                if (ast.isVariableDecl(node) || ast.isFunctionDecl(node) || ast.isStructDecl(node)) {
                    if (node.name) {
                        exportedItems.push(this.descriptions.createDescription(node, node.name, document));
                    }
                }
                else if (ast.isExternBlock(node)) {
                    for (const func of node.funcs) {
                        if (func.name) {
                            exportedItems.push(this.descriptions.createDescription(func, func.name, document));
                        }
                    }
                }
                else if (ast.isExternSingleStmt(node) && node.func) {
                    if (node.func.name) {
                        exportedItems.push(this.descriptions.createDescription(node.func, node.func.name, document));
                    }
                }
            }
        }
        return exportedItems;
    }
}

export class WhiteLanguageScopeProvider extends DefaultScopeProvider {

    override getScope(context: ReferenceInfo): Scope {
        const container = context.container;
        if (ast.isSymbolImport(container) && context.property === 'importedElement') {
            const importStmt = container.$container as ast.Import;
            if (importStmt.fromPath) {
                return this.getScopeByPath(container, importStmt.fromPath);
            }
        }
        if (context.property === 'ref' || (ast.isReference(container) && context.property === 'ref')) {
            const program = AstUtils.getContainerOfType(container, ast.isProgram);
            if (program) {
                const descriptions: AstNodeDescription[] = [];
                
                for (const stmt of program.statements) {
                    if (ast.isImport(stmt)) {
                        for (const si of stmt.symbolImports) {
                            const name = si.name ?? si.importedElement?.$refText;
                            if (name) {
                                descriptions.push(this.descriptions.createDescription(si, name));
                            }
                        }
                        for (const fi of stmt.fileImports) {
                            const name = fi.name ?? fi.path.replace(/"/g, '').split('/').pop()?.replace('.wl', '');
                            if (name) {
                                descriptions.push(this.descriptions.createDescription(fi, name));
                            }
                        }
                    }
                }
                const importScope = this.createScope(descriptions, super.getScope(context));
                const localExterns: AstNode[] = [];
                for (const stmt of program.statements) {
                    if (ast.isExternBlock(stmt)) localExterns.push(...stmt.funcs);
                    else if (ast.isExternSingleStmt(stmt) && stmt.func) localExterns.push(stmt.func);
                }

                return this.createScopeForNodes(localExterns, importScope);
            }
        }
        if (ast.isMemberAccess(container) && context.property === 'member') {
            const receiver = container.receiver;
            if (ast.isReference(receiver)) {
                const ref = receiver.ref?.ref;
                if (ast.isFileImport(ref)) {
                    return this.getScopeFromImportedFile(ref);
                }
            }
            const structDef = this.inferStructType(container.receiver);
            if (structDef) {
                return this.createScopeForNodes(structDef.fields);
            }
            return EMPTY_SCOPE;
        }

        return super.getScope(context);
    }

    private getScopeByPath(contextNode: AstNode, rawPath: string): Scope {
        const currentDoc = AstUtils.getDocument(contextNode);
        const cleanPath = rawPath.replace(/"/g, '');
        const baseUri = Utils.resolvePath(Utils.dirname(currentDoc.uri), cleanPath);
        const baseUriStr = baseUri.toString();
        const fileUri = baseUriStr.endsWith('.wl') ? baseUri : baseUri.with({ path: baseUri.path + '.wl' });
        const fileUriStr = fileUri.toString();
        const dirUriStr = baseUriStr.endsWith('/') ? baseUriStr : baseUriStr + '/';

        const exportedNodes = this.indexManager.allElements().filter(desc => {
            const docUriStr = desc.documentUri.toString();
            return docUriStr === fileUriStr || docUriStr.startsWith(dirUriStr);
        });
            
        return new StreamScope(exportedNodes);
    }

    public getScopeFromImportedFile(fileImport: ast.FileImport): Scope {
        return this.getScopeByPath(fileImport, fileImport.path);
    }

    private inferStructType(node: ast.Expression): ast.StructDecl | undefined {
        if (ast.isReference(node)) {
            const decl = node.ref?.ref; 
            if (decl) {
                const type = ast.isSymbolImport(decl) ? this.getImportedType(decl) : (decl as any).type;
                return this.resolveTypeToStruct(type);
            }
        } 
        else if (ast.isMemberAccess(node)) {
            const leftStruct = this.inferStructType(node.receiver);
            if (leftStruct) {
                const field = leftStruct.fields.find(f => f.name === node.member);
                if (field) return this.resolveTypeToStruct(field.type);
            }
        } 
        else if (ast.isDerefExpression(node)) {
            const base = this.inferPointerBaseType(node.value);
            if (base) return this.resolveTypeToStruct(base);
        }
        else if (ast.isThisExpression(node)) {
            return AstUtils.getContainerOfType(node, ast.isStructDecl);
        }
        return undefined;
    }

    private getImportedType(node: ast.SymbolImport): ast.TypeReference | undefined {
        const realDecl = node.importedElement?.ref;
        if (realDecl && ('type' in realDecl)) {
            return (realDecl as any).type;
        }
        return undefined;
    }

    private inferPointerBaseType(node: ast.Expression): ast.TypeReference | undefined {
        if (ast.isReference(node)) {
            const decl = node.ref?.ref;
            if (decl) {
                const type = ast.isSymbolImport(decl) ? this.getImportedType(decl) : (decl as any).type;
                if ((decl as any).isPtr) return type;
                if (ast.isPointerType(type)) return type.elementType;
            }
        }
        return undefined;
    }

    private resolveTypeToStruct(type: ast.TypeReference | undefined): ast.StructDecl | undefined {
        if (!type) return undefined;
        if (ast.isPointerType(type)) return this.resolveTypeToStruct(type.elementType);
        
        if (ast.isNamedType(type) && type.ref) {
            let ref = type.ref.ref;
            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }
            if (ast.isStructDecl(ref)) return ref;
        }
        return undefined;
    }
}