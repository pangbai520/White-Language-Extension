import { 
    DefaultScopeProvider, 
    type Scope, 
    type ReferenceInfo, 
    AstUtils,
    DefaultScopeComputation,
    type LangiumDocument,
    type AstNodeDescription,
    EMPTY_SCOPE,
    type AstNode,
} from 'langium';
import type { CancellationToken } from 'vscode-languageserver';
import { Utils, URI } from 'vscode-uri'; 
import * as ast from './generated/ast.js';
import type { WhiteLanguageServices } from './white-language-module.js';

export class WhiteLanguageScopeComputation extends DefaultScopeComputation {
    async computeExports(document: LangiumDocument, _cancelToken?: CancellationToken): Promise<AstNodeDescription[]> {
        const exportedItems: AstNodeDescription[] = [];
        const rootNode = document.parseResult.value;

        if (ast.isProgram(rootNode)) {
            for (const node of rootNode.statements) {
                if (ast.isVariableDecl(node) || ast.isFunctionDecl(node) || ast.isStructDecl(node) || ast.isClassDecl(node)) {
                    if (node.name) {
                        exportedItems.push(this.descriptions.createDescription(node, node.name, document));
                    }
                }
                else if (ast.isImport(node)) {
                    for (const si of node.symbolImports) {
                        const name = si.name ?? si.importedElement?.$refText;
                        if (name) {
                            exportedItems.push(this.descriptions.createDescription(si, name, document));
                        }
                    }
                    for (const fi of node.fileImports) {
                        if (fi.name) {
                            exportedItems.push(this.descriptions.createDescription(fi, fi.name, document));
                        }
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
                else if (ast.isTypeExtension(node)) {
                    let typeName = '';
                    if (ast.isPrimitiveType(node.type)) typeName = node.type.name ?? '';
                    else if (ast.isNamedType(node.type)) typeName = node.type.ref?.$refText || '';
                    if (typeName) {
                        exportedItems.push(this.descriptions.createDescription(node, `__ext_${typeName}`, document));
                    }
                }
            }
        }
        return exportedItems;
    }
}

export class WhiteLanguageScopeProvider extends DefaultScopeProvider {
    private typeCache = new WeakMap<AstNode, ast.StructDecl | ast.ClassDecl | undefined>();
    private importScopeCache = new WeakMap<AstNode, Scope>();
    private programImportScopeCache = new WeakMap<ast.Program, Scope>();
    
    private services: WhiteLanguageServices;

    constructor(services: WhiteLanguageServices) {
        super(services);
        this.services = services;
    }

    protected override getGlobalScope(referenceType: string, context: ReferenceInfo): Scope {
        const program = AstUtils.getContainerOfType(context.container, ast.isProgram);
        if (!program) return EMPTY_SCOPE;

        let importScope = this.programImportScopeCache.get(program);
        
        if (!importScope) {
            const descriptions: AstNodeDescription[] = [];
            for (const stmt of program.statements) {
                if (ast.isExternBlock(stmt)) {
                    for (const func of stmt.funcs) {
                        if (func.name) {
                            descriptions.push(this.descriptions.createDescription(func, func.name, AstUtils.getDocument(stmt)));
                        }
                    }
                } else if (ast.isExternSingleStmt(stmt) && stmt.func) {
                    if (stmt.func.name) {
                        descriptions.push(this.descriptions.createDescription(stmt.func, stmt.func.name, AstUtils.getDocument(stmt)));
                    }
                }
            }

            for (const stmt of program.statements) {
                if (ast.isImport(stmt)) {
                    for (const si of stmt.symbolImports) {
                        const name = si.name ?? si.importedElement?.$refText;
                        if (name) descriptions.push(this.descriptions.createDescription(si, name, AstUtils.getDocument(stmt)));
                    }
                    for (const fi of stmt.fileImports) {
                        const cleanPath = fi.path.replace(/"/g, '').replace(/\.wl$/, '');
                        const name = fi.name ?? cleanPath.split('/').pop();
                        
                        if (name) {
                            descriptions.push(this.descriptions.createDescription(fi, name, AstUtils.getDocument(stmt)));
                        }

                        const targetUri = this.resolvePackageUri(AstUtils.getDocument(stmt).uri, fi.path);
                        
                        if (targetUri) {
                            const isPackage = targetUri.path.endsWith('_pkg.wl');
                            if (!isPackage) {
                                const fileElements = this.indexManager.allElements().filter(desc => 
                                    desc.documentUri.path === targetUri.path
                                ).toArray();
                                descriptions.push(...fileElements);
                            }
                        }
                    }
                }
            }
            importScope = this.createScope(descriptions, EMPTY_SCOPE);
            this.programImportScopeCache.set(program, importScope);
        }

        return importScope;
    }

    private resolvePackageUri(sourceDocUri: URI, rawPath: string): URI | undefined {
        const actualPath = rawPath.replace(/"/g, '');
        const hasExtension = actualPath.endsWith('.wl');
        const cleanPath = hasExtension ? actualPath.substring(0, actualPath.length - 3) : actualPath;

        const baseUri = Utils.resolvePath(Utils.dirname(sourceDocUri), cleanPath);
        const documents = this.services.shared.workspace.LangiumDocuments;

        const fileUri = baseUri.with({ path: baseUri.path + '.wl' });
        const pkgUri = baseUri.with({ path: baseUri.path + '/_pkg.wl' });

        if (hasExtension) {
            if (documents.hasDocument(fileUri)) return fileUri;
        } else {
            if (documents.hasDocument(pkgUri)) return pkgUri;
        }

        for (const desc of this.indexManager.allElements()) {
            const path = desc.documentUri.path;
            
            if (path.endsWith(`/${cleanPath}.wl`) || path.endsWith(`/${cleanPath}/_pkg.wl`)) {

                if (!hasExtension && path.endsWith(`/${cleanPath}.wl`)) {
                    if (desc.documentUri.path === fileUri.path) {
                        continue;
                    }
                }
                
                return desc.documentUri;
            }
        }

        return undefined;
    }

    override getScope(context: ReferenceInfo): Scope {
        const container = context.container;
        
        if (ast.isSymbolImport(container) && context.property === 'importedElement') {
            const importStmt = container.$container as ast.Import;
            if (importStmt.fromPath) {
                return this.getScopeByPath(container, importStmt.fromPath);
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
            const def = this.inferStructOrClassType(container.receiver);
            if (def) {
                const members = 'fields' in def ? def.fields : def.members;
                return this.createScopeForNodes(members);
            }

            const typeStr = this.inferExpressionTypeStr(container.receiver);
            if (typeStr) {
                const extMethods: ast.FunctionDecl[] = [];
                const program = AstUtils.getContainerOfType(container, ast.isProgram);
                if (program) {
                    for (const stmt of program.statements) {
                        if (ast.isTypeExtension(stmt)) {
                            let tName = '';
                            if (ast.isPrimitiveType(stmt.type)) tName = stmt.type.name ?? '';
                            else if (ast.isNamedType(stmt.type)) tName = stmt.type.ref?.$refText || '';
                            if (tName === typeStr) extMethods.push(...stmt.methods);
                        }
                    }
                    const globalScope = this.programImportScopeCache.get(program);
                    if (globalScope) {
                        const extElems = globalScope.getAllElements().toArray().filter(e => e.name === `__ext_${typeStr}`);
                        for (const e of extElems) {
                            const extNode = e.node;
                            if (extNode && ast.isTypeExtension(extNode)) {
                                extMethods.push(...extNode.methods);
                            }
                        }
                    }
                }
                if (extMethods.length > 0) {
                    return this.createScopeForNodes(extMethods);
                }
            }

            return EMPTY_SCOPE;
        }

        return super.getScope(context);
    }

    private getScopeByPath(contextNode: AstNode, rawPath: string): Scope {
        if (this.importScopeCache.has(contextNode)) {
            return this.importScopeCache.get(contextNode)!;
        }
        
        const targetUri = this.resolvePackageUri(AstUtils.getDocument(contextNode).uri, rawPath);
        let exportedNodes: AstNodeDescription[] = [];

        if (targetUri) {
            if (targetUri.path.endsWith('_pkg.wl')) {
                const dirUriStr = Utils.dirname(targetUri).path + '/';
                exportedNodes = this.indexManager.allElements().filter(desc => 
                    desc.documentUri.path.startsWith(dirUriStr)
                ).toArray();
            } else {
                exportedNodes = this.indexManager.allElements().filter(desc => 
                    desc.documentUri.path === targetUri.path
                ).toArray();
            }
        }

        const scope = this.createScope(exportedNodes);
        this.importScopeCache.set(contextNode, scope);
        return scope;
    }

    public getScopeFromImportedFile(fileImport: ast.FileImport): Scope {
        return this.getScopeByPath(fileImport, fileImport.path);
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

    public inferStructOrClassType(node: ast.Expression): ast.StructDecl | ast.ClassDecl | undefined {
        if (this.typeCache.has(node)) {
            return this.typeCache.get(node);
        }

        let result: ast.StructDecl | ast.ClassDecl | undefined = undefined;

        if (ast.isReference(node)) {
            const decl = node.ref?.ref; 
            if (decl) {
                const type = ast.isSymbolImport(decl) ? this.getImportedType(decl) : (decl as any).type;
                result = this.resolveTypeToStructOrClass(type);
            }
        } 
        else if (ast.isMemberAccess(node)) {
            const leftDef = this.inferStructOrClassType(node.receiver);
            if (leftDef) {
                const members = 'fields' in leftDef ? leftDef.fields : leftDef.members;
                const field = members.find((f: any) => f.name === node.member);
                if (field) result = this.resolveTypeToStructOrClass((field as any).type);
            }
        } 
        else if (ast.isDerefExpression(node)) {
            const base = this.inferPointerBaseType(node.value);
            if (base) result = this.resolveTypeToStructOrClass(base);
        }
        else if (ast.isThisExpression(node) || ast.isSelfExpression(node)) {
            result = AstUtils.getContainerOfType(node, ast.isStructDecl) ?? AstUtils.getContainerOfType(node, ast.isClassDecl);
        }
        else if (ast.isSuperExpression(node)) {
            const cls = AstUtils.getContainerOfType(node, ast.isClassDecl);
            if (cls && cls.superClass?.ref) {
                const superDecl = cls.superClass.ref;
                if (ast.isClassDecl(superDecl)) result = superDecl;
            }
        }

        this.typeCache.set(node, result);
        return result;
    }

    public inferExpressionTypeStr(node: ast.Expression): string | undefined {
        if (ast.isLiteral(node)) {
            const text = node.$cstNode?.text || "";
            if (text.startsWith('"')) return 'String';
            if (text === 'true' || text === 'false') return 'Bool';
            if (text.includes('.')) return 'Float';
            if (text === 'null' || text === 'nullptr') return 'Pointer';
            return 'Int';
        }
        if (ast.isReference(node)) {
            const decl = node.ref?.ref;
            if (ast.isVariableDecl(decl) || ast.isForVarDecl(decl) || ast.isParam(decl) || ast.isClassField(decl)) {
                return this.getTypeRefString(decl.type);
            }
        }
        if (ast.isFunctionCall(node)) {
            const caller = node.caller;
            if (ast.isReference(caller)) {
                const func = caller.ref?.ref;
                if (ast.isFunctionDecl(func) || ast.isExternFuncDecl(func) || ast.isClassMethod(func)) {
                    return this.getTypeRefString((func as any).returnType);
                }
            }
        }
        if (ast.isThisExpression(node) || ast.isSelfExpression(node)) {
            const ext = AstUtils.getContainerOfType(node, ast.isTypeExtension);
            if (ext) return this.getTypeRefString(ext.type);
            const cls = AstUtils.getContainerOfType(node, ast.isClassDecl);
            if (cls) return cls.name;
            const str = AstUtils.getContainerOfType(node, ast.isStructDecl);
            if (str) return str.name;
        }
        return undefined;
    }

    private getTypeRefString(type: ast.TypeReference | undefined): string | undefined {
        if (!type) return undefined;
        if (ast.isPrimitiveType(type)) return type.name;
        if (ast.isNamedType(type)) return type.ref?.$refText;
        if (ast.isPointerType(type)) return `ptr<${this.getTypeRefString(type.elementType)}>`;
        return undefined;
    }

    private resolveTypeToStructOrClass(type: ast.TypeReference | undefined): ast.StructDecl | ast.ClassDecl | undefined {
        if (!type) return undefined;
        if (ast.isPointerType(type)) return this.resolveTypeToStructOrClass(type.elementType);
        
        if (ast.isNamedType(type) && type.ref) {
            let ref = type.ref.ref;
            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }
            if (ast.isStructDecl(ref) || ast.isClassDecl(ref)) return ref;
        }
        return undefined;
    }
}