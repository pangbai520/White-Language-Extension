// packages/language/src/white-language-goto-resolver.ts
import { type AstNode, type CstNode, AstUtils, type MaybePromise, type LangiumDocuments } from 'langium';
import { DefaultDefinitionProvider } from 'langium/lsp';
import { type LocationLink, type DefinitionParams } from 'vscode-languageserver-protocol';
import * as ast from './generated/ast.js';
import { type WhiteLanguageServices } from './white-language-module.js';
import { type WhiteLanguageScopeProvider } from './white-language-scope-provider.js';
import { type URI, Utils } from 'vscode-uri';

export class WhiteLanguageDefinitionProvider extends DefaultDefinitionProvider {
    private scopeProvider: WhiteLanguageScopeProvider;
    private documents: LangiumDocuments;

    constructor(services: WhiteLanguageServices) {
        super(services);
        this.scopeProvider = services.references.ScopeProvider as WhiteLanguageScopeProvider;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected override collectLocationLinks(sourceCstNode: CstNode, _params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const astNode = sourceCstNode.astNode;

        // 1. 成员访问跳转 (如 builtin.print 的 print)
        if (ast.isMemberAccess(astNode) && sourceCstNode.text === astNode.member) {
            const targetNode = this.resolveMemberAccess(astNode);
            if (targetNode && targetNode.$cstNode) {
                const targetCst = targetNode.$cstNode;
                const document = AstUtils.getDocument(targetNode);
                const link: LocationLink = {
                    originSelectionRange: sourceCstNode.range,
                    targetUri: document.uri.toString(),
                    targetRange: targetCst.range,
                    targetSelectionRange: targetCst.range
                };
                return [link];
            }
        }

        // 2. 包与文件导入跳转
        let targetImportPath: string | undefined;

        // 辅助函数：安全地提取路径（规避 TS 报错，同时兼容属性和正则提取）
        const extractPath = (node: AstNode): string | undefined => {
            if ('path' in node && typeof (node as any).path === 'string') {
                return (node as any).path;
            }
            // 兜底方案：直接从 CST 节点的源码文本中用正则抠出双引号内的路径
            if (node.$cstNode) {
                const match = node.$cstNode.text.match(/"([^"]+)"/);
                if (match) return match[1];
            }
            return undefined;
        };

        // 情景 A: 点击 import 语句本身
        if (ast.isFileImport(astNode) || ast.isSymbolImport(astNode)) {
            targetImportPath = extractPath(astNode);
        } 
        // 情景 B: 精准点击到了 import "builtin" 里的字符串字面量
        else if (astNode.$type === 'StringLiteral' || ast.isLiteral(astNode)) {
            const container = astNode.$container;
            if (container && (ast.isFileImport(container) || ast.isSymbolImport(container))) {
                targetImportPath = extractPath(container);
            }
        }

        // 情景 C: 点击代码里的包名前缀 (如 builtin.print 的 builtin)
        if (ast.isReference(astNode) && sourceCstNode.text === astNode.$cstNode?.text) {
            const ref = astNode.ref?.ref;
            if (ref && (ast.isFileImport(ref) || ast.isSymbolImport(ref))) {
                targetImportPath = extractPath(ref);
            }
        }

        // 查找到路径后，映射 URI
        if (targetImportPath) {
            const sourceDocUri = AstUtils.getDocument(astNode).uri;
            const targetUri = this.resolvePackageUri(sourceDocUri, targetImportPath);
            
            if (targetUri) {
                const link: LocationLink = {
                    originSelectionRange: sourceCstNode.range,
                    targetUri: targetUri.toString(),
                    targetRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    targetSelectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
                };
                return [link];
            }
        }

        // 兜底跳转
        return super.collectLocationLinks(sourceCstNode, _params);
    }

    private resolvePackageUri(sourceDocUri: URI, rawPath: string): URI | undefined {
        const cleanPath = rawPath.replace(/"/g, '').replace(/\.wl$/, '');
        
        // 本地路径
        const baseUri = Utils.resolvePath(Utils.dirname(sourceDocUri), cleanPath);
        const baseUriStr = baseUri.toString();
        const localFileUriStr = baseUriStr + '.wl';

        // 全局路径
        const globalPkgSuffix = `/${cleanPath}/_pkg.wl`;
        const globalFileSuffix = `/${cleanPath}.wl`;

        for (const doc of this.documents.all) {
            const docUriStr = doc.uri.toString();
            if (docUriStr === localFileUriStr || docUriStr === baseUriStr) return doc.uri;
            if (docUriStr.endsWith(globalPkgSuffix)) return doc.uri;
            if (docUriStr.endsWith(globalFileSuffix)) return doc.uri;
        }
        
        return undefined;
    }

    private resolveMemberAccess(node: ast.MemberAccess): AstNode | undefined {
        const receiver = node.receiver;

        if (ast.isReference(receiver)) {
            let ref = receiver.ref?.ref;
            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }
            if (ast.isFileImport(ref)) {
                const scope = this.scopeProvider.getScopeFromImportedFile(ref);
                const element = scope.getElement(node.member);
                if (element && element.node) {
                    return element.node;
                }
            }
        }

        const def = this.scopeProvider.inferStructOrClassType(receiver);
        if (def) {
            const members = 'fields' in def ? def.fields : def.members;
            const field = members.find((f: any) => 
                f.name === node.member || 
                (ast.isClassInit(f) && node.member === 'init') || 
                (ast.isClassDeinit(f) && node.member === 'deinit')
            );
            if (field) {
                return field as AstNode;
            }
        }

        return undefined;
    }
}