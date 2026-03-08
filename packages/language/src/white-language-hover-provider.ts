import { type AstNode } from 'langium';
import { AstNodeHoverProvider } from 'langium/lsp';
import * as ast from './generated/ast.js';
import type { WhiteLanguageServices } from './white-language-module.js';

export class WhiteLanguageHoverProvider extends AstNodeHoverProvider {
    
    constructor(services: WhiteLanguageServices) {
        super(services);
    }

    protected override getAstNodeHoverContent(node: AstNode): string | undefined {

        if (ast.isReference(node)) {
            let ref = node.ref?.ref;
            if (ast.isSymbolImport(ref)) {
                ref = ref.importedElement?.ref;
            }
            if (ref) {
                return this.getDeclarationInfo(ref);
            }
        }


        if (ast.isVariableDecl(node) || ast.isForVarDecl(node) || ast.isParam(node) || 
            ast.isFunctionDecl(node) || ast.isExternFuncDecl(node) || ast.isStructDecl(node)) {
            return this.getDeclarationInfo(node);
        }

        return undefined;
    }

    private getDeclarationInfo(decl: AstNode): string | undefined {

        if (ast.isVariableDecl(decl) || ast.isForVarDecl(decl)) {
            const isPtrStr = decl.isPtr ? `ptr${decl.ptrLevel ? '*' + decl.ptrLevel : ''} ` : '';
            const typeStr = decl.type ? decl.type.$cstNode?.text : 'Unknown';
            const kind = ast.isVariableDecl(decl) ? decl.kind : 'let';
            return `\`\`\`whitelang\n${kind} ${decl.name} -> ${isPtrStr}${typeStr}\n\`\`\``;
        }
        

        if (ast.isParam(decl)) {
            const isPtrStr = decl.isPtr ? `ptr${decl.ptrLevel ? '*' + decl.ptrLevel : ''} ` : '';
            const typeStr = decl.type ? decl.type.$cstNode?.text : 'Unknown';
            return `\`\`\`whitelang\n(parameter) ${decl.name} -> ${isPtrStr}${typeStr}\n\`\`\``;
        }
        

        if (ast.isFunctionDecl(decl) || ast.isExternFuncDecl(decl)) {
            const params = decl.params.map(p => {
                const isPtrStr = p.isPtr ? `ptr${p.ptrLevel ? '*' + p.ptrLevel : ''} ` : '';
                const typeStr = p.type ? p.type.$cstNode?.text : 'Unknown';
                return `${p.name} -> ${isPtrStr}${typeStr}`;
            }).join(', ');
            const varArgs = decl.varArgs ? (params.length > 0 ? ', ...' : '...') : '';
            const retType = decl.returnType ? decl.returnType.$cstNode?.text : 'Void';
            const prefix = ast.isExternFuncDecl(decl) ? 'extern func' : 'func';
            return `\`\`\`whitelang\n${prefix} ${decl.name}(${params}${varArgs}) -> ${retType}\n\`\`\``;
        }
        

        if (ast.isStructDecl(decl)) {
            return `\`\`\`whitelang\nstruct ${decl.name}\n\`\`\``;
        }
        

        if (ast.isFileImport(decl)) {
            return `\`\`\`whitelang\nmodule ${decl.name || decl.path}\n\`\`\``;
        }
        
        return undefined;
    }
}