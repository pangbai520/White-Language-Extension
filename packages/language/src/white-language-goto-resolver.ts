import { type AstNode, type CstNode, AstUtils, type MaybePromise, type LangiumDocuments, type AstNodeDescription } from 'langium';
import { DefaultDefinitionProvider } from 'langium/lsp';
import { type LocationLink, type DefinitionParams } from 'vscode-languageserver-protocol';
import * as ast from './generated/ast.js';
import { type WhiteLanguageServices } from './white-language-module.js';
import { type WhiteLanguageScopeProvider } from './white-language-scope-provider.js';
import { type URI, Utils } from 'vscode-uri';

export class WhiteLanguageDefinitionProvider extends DefaultDefinitionProvider {
    private scopeProvider: WhiteLanguageScopeProvider;
    private documents: LangiumDocuments;
    private services: WhiteLanguageServices;

    constructor(services: WhiteLanguageServices) {
        super(services);
        this.services = services;
        this.scopeProvider = services.references.ScopeProvider as WhiteLanguageScopeProvider;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected override collectLocationLinks(sourceCstNode: CstNode, _params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const astNode = sourceCstNode.astNode;
        if (ast.isMemberAccess(astNode) && sourceCstNode.text === astNode.member) {
            const target = this.resolveMemberAccess(astNode);
            if (target) return this.createLinksFromTarget(sourceCstNode, target);
        }
        if (ast.isSymbolImport(astNode)) {
            const name = astNode.name ?? astNode.importedElement?.$refText;
            if (sourceCstNode.text === name) {
                let ref = astNode.importedElement?.ref;
                if (ref) {
                    if (ast.isFileImport(ref)) {
                        const sourceDocUri = AstUtils.getDocument(ref).uri;
                        const subUri = this.resolvePackageUri(sourceDocUri, ref.path);
                        if (subUri) {
                            const subDoc = this.documents.getDocument(subUri);
                            if (subDoc && subDoc.parseResult) {
                                const subProgram = subDoc.parseResult.value as ast.Program;
                                for (const subStmt of subProgram.statements) {
                                    if ((ast.isFunctionDecl(subStmt) || ast.isVariableDecl(subStmt) || ast.isClassDecl(subStmt) || ast.isStructDecl(subStmt)) && subStmt.name === name) {
                                        return this.createLinksFromTarget(sourceCstNode, subStmt);
                                    }
                                }
                            }
                            return [{
                                originSelectionRange: sourceCstNode.range,
                                targetUri: subUri.toString(),
                                targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                                targetSelectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
                            }];
                        }
                    }
                    return this.createLinksFromTarget(sourceCstNode, ref);
                }
            }
        }

        let targetImportPath: string | undefined;
        const extractPath = (node: AstNode): string | undefined => {
            if ('path' in node && typeof (node as any).path === 'string') return (node as any).path;
            if ('fromPath' in node && typeof (node as any).fromPath === 'string') return (node as any).fromPath;
            if (node.$cstNode) {
                const match = node.$cstNode.text.match(/"([^"]+)"/);
                if (match) return match[1];
            }
            return undefined;
        };

        if (ast.isFileImport(astNode) || ast.isImport(astNode)) {
            targetImportPath = extractPath(astNode);
        } else if (astNode.$type === 'StringLiteral' || ast.isLiteral(astNode)) {
            const container = astNode.$container;
            if (container && (ast.isFileImport(container) || ast.isImport(container))) {
                targetImportPath = extractPath(container);
            }
        }

        if (ast.isReference(astNode) && sourceCstNode.text === astNode.$cstNode?.text) {
            const ref = astNode.ref?.ref;
            if (ref && (ast.isFileImport(ref) || ast.isSymbolImport(ref))) {
                targetImportPath = extractPath(ref);
            }
        }

        if (targetImportPath) {
            const sourceDocUri = AstUtils.getDocument(astNode).uri;
            const targetUri = this.resolvePackageUri(sourceDocUri, targetImportPath);
            if (targetUri) {
                return [{
                    originSelectionRange: sourceCstNode.range,
                    targetUri: targetUri.toString(),
                    targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    targetSelectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
                }];
            }
            return [];
        }

        return super.collectLocationLinks(sourceCstNode, _params);
    }

    private resolvePackageUri(sourceDocUri: URI, rawPath: string): URI | undefined {
        const cleanPath = rawPath.replace(/"/g, '').replace(/\.wl$/, '');
        const baseUri = Utils.resolvePath(Utils.dirname(sourceDocUri), cleanPath);
        const baseUriStr = baseUri.toString();
        
        for (const doc of this.documents.all) {
            const uriStr = doc.uri.toString();
            if (uriStr === baseUriStr + '.wl' || uriStr.endsWith(`/${cleanPath}/_pkg.wl`)) return doc.uri;
        }

        for (const doc of this.documents.all) {
            const uriStr = doc.uri.toString();
            if (uriStr.includes(`/${cleanPath}/_pkg.wl`) || uriStr.includes(`/${cleanPath}.wl`)) return doc.uri;
        }

        return undefined;
    }

    private resolveMemberAccess(node: ast.MemberAccess): AstNode | AstNodeDescription | undefined {
        const receiver = node.receiver;

        if (ast.isReference(receiver)) {
            let ref = receiver.ref?.ref;
            if (ast.isSymbolImport(ref)) ref = ref.importedElement?.ref;
            
            if (ast.isFileImport(ref)) {
                const sourceDocUri = AstUtils.getDocument(node).uri;
                const targetUri = this.resolvePackageUri(sourceDocUri, ref.path);
                
                if (targetUri) {
                    const doc = this.documents.getDocument(targetUri);
                    if (doc && doc.parseResult) {
                        const program = doc.parseResult.value as ast.Program;
                        for (const stmt of program.statements) {
                            if ((ast.isFunctionDecl(stmt) || ast.isVariableDecl(stmt) || ast.isClassDecl(stmt) || ast.isStructDecl(stmt)) && stmt.name === node.member) {
                                return stmt;
                            }
                            if (ast.isExternBlock(stmt)) {
                                const ext = stmt.funcs.find(f => f.name === node.member);
                                if (ext) return ext;
                            }
                            if (ast.isImport(stmt)) {
                                for (const si of stmt.symbolImports) {
                                    const name = si.name ?? si.importedElement?.$refText;
                                    if (name === node.member && si.importedElement?.ref) return si.importedElement.ref;
                                }
                                
                                for (const fi of stmt.fileImports) {
                                    const name = fi.name ?? fi.path.replace(/"/g, '').split('/').pop()?.replace('.wl', '');
                                    if (name === node.member) {
                                        const subUri = this.resolvePackageUri(targetUri, fi.path);
                                        if (subUri) {
                                            const subDoc = this.documents.getDocument(subUri);
                                            if (subDoc && subDoc.parseResult) {
                                                const subProgram = subDoc.parseResult.value as ast.Program;
                                                for (const subStmt of subProgram.statements) {
                                                    if ((ast.isFunctionDecl(subStmt) || ast.isVariableDecl(subStmt) || ast.isClassDecl(subStmt) || ast.isStructDecl(subStmt)) && subStmt.name === node.member) {
                                                        return subStmt;
                                                    }
                                                }
                                            }
                                        }
                                        return fi;
                                    }
                                }
                            }
                        }
                    }
                }
                const cleanPath = ref.path.replace(/"/g, '').replace(/\.wl$/, '');
                for (const doc of this.documents.all) {
                    const uriStr = doc.uri.toString();
                    if (uriStr.includes(`/${cleanPath}/`) || uriStr.endsWith(`/${cleanPath}.wl`)) {
                        if (doc.parseResult && ast.isProgram(doc.parseResult.value)) {
                            for (const stmt of doc.parseResult.value.statements) {
                                if ((ast.isFunctionDecl(stmt) || ast.isVariableDecl(stmt) || ast.isClassDecl(stmt) || ast.isStructDecl(stmt)) && stmt.name === node.member) {
                                    return stmt;
                                }
                            }
                        }
                    }
                }
                return ref;
            }
        }

        const def = this.scopeProvider.inferStructOrClassType(receiver);
        if (def) {
            const members = ast.isStructDecl(def) ? def.fields : def.members;
            return members.find((m: any) => m.name === node.member);
        }

        return undefined;
    }

    private createLinksFromTarget(sourceCstNode: CstNode, target: AstNode | AstNodeDescription): LocationLink[] {
        if ('documentUri' in target) {
            const doc = this.documents.getDocument(target.documentUri);
            let range = target.nameSegment?.range ?? target.selectionSegment?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
            if (doc && doc.parseResult) {
                const realNode = target.node ?? this.services.workspace.AstNodeLocator.getAstNode(doc.parseResult.value, target.path);
                if (realNode?.$cstNode) range = realNode.$cstNode.range;
            }
            return [{
                originSelectionRange: sourceCstNode.range,
                targetUri: target.documentUri.toString(),
                targetRange: range,
                targetSelectionRange: range
            }];
        } else {
            const targetCst = target.$cstNode;
            if (!targetCst) return [];
            return [{
                originSelectionRange: sourceCstNode.range,
                targetUri: AstUtils.getDocument(target).uri.toString(),
                targetRange: targetCst.range,
                targetSelectionRange: targetCst.range
            }];
        }
    }
}