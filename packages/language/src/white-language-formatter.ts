import { AbstractFormatter, Formatting } from 'langium/lsp';
import { type AstNode } from 'langium';
import * as ast from './generated/ast.js';

export class WhiteLanguageFormatter extends AbstractFormatter {

    protected format(node: AstNode): void {
        const formatter = this.getNodeFormatter(node);
        formatter.keywords(',').prepend(Formatting.noSpace());
        formatter.keywords(',').append(Formatting.oneSpace());

        if (ast.isBinaryExpression(node) || ast.isAssignment(node)) {
            formatter.property('op').prepend(Formatting.oneSpace());
            formatter.property('op').append(Formatting.oneSpace());
        }

        if (ast.isVariableDecl(node) || ast.isForVarDecl(node) || ast.isParam(node) || ast.isClassField(node)) {
            const arrow = formatter.keyword('->');
            if (arrow) {
                arrow.prepend(Formatting.oneSpace());
                arrow.append(Formatting.oneSpace());
            }
            const eq = formatter.keyword('=');
            if (eq) {
                eq.prepend(Formatting.oneSpace());
                eq.append(Formatting.oneSpace());
            }
        }

        if (ast.isArgument(node)) {
            const eq = formatter.keyword('=');
            if (eq) {
                eq.prepend(Formatting.noSpace());
                eq.append(Formatting.noSpace());
            }
        }

        if (ast.isBlock(node) || ast.isClassDecl(node) || ast.isExternBlock(node)) {
            const leftBrace = formatter.keyword('{');
            const rightBrace = formatter.keyword('}');
            
            if (leftBrace && rightBrace) {
                formatter.interior(leftBrace, rightBrace).prepend(Formatting.indent());
                leftBrace.prepend(Formatting.oneSpace());
                rightBrace.prepend(Formatting.newLine());
            }

            if (ast.isClassDecl(node) || ast.isExternBlock(node)) {
                formatter.node(node).prepend(Formatting.newLine({ allowMore: true }));
            }
        }

        if (ast.isExpressionStmt(node) || ast.isSpecialStmt(node) || ast.isEmptyStmt(node) || ast.isImport(node)) {
            const semi = formatter.keyword(';');
            if (semi) {
                semi.prepend(Formatting.noSpace());
                semi.append(Formatting.newLine());
            }
        }
        else if (ast.isDeclarationStmt(node)) {
            const semi = formatter.keyword(';');
            if (semi) {
                semi.prepend(Formatting.noSpace());
                semi.append(Formatting.newLine());
            }
        }
        else if (ast.isForStmt(node)) {
            formatter.keywords(';').prepend(Formatting.noSpace());
            formatter.keywords(';').append(Formatting.oneSpace());
        }

        if (ast.isIfStmt(node)) {
            formatter.keyword('if').append(Formatting.oneSpace());
            const elseKw = formatter.keyword('else');
            if (elseKw) {
                elseKw.prepend(Formatting.oneSpace());
                elseKw.append(Formatting.oneSpace());
            }
        }
        else if (ast.isWhileStmt(node)) {
            formatter.keyword('while').append(Formatting.oneSpace());
        }
        else if (ast.isForStmt(node)) {
            formatter.keyword('for').append(Formatting.oneSpace());
        }

        if (ast.isExternSingleStmt(node)) {
            formatter.keyword('extern').append(Formatting.oneSpace());
        }

        if (ast.isArgument(node)) {
            const eq = formatter.keyword('=');
            if (eq) {
                eq.prepend(Formatting.noSpace());
                eq.append(Formatting.noSpace());
            }
        }

        if (ast.isFunctionDecl(node) || ast.isStructDecl(node) || ast.isExternFuncDecl(node) || 
            ast.isClassMethod(node) || ast.isClassInit(node) || ast.isClassDeinit(node)) {
            
            const leftParen = formatter.keyword('(');
            const rightParen = formatter.keyword(')');

            if (leftParen) {
                leftParen.prepend(Formatting.noSpace());
            }
            let params: ast.Param[] = [];
            if (ast.isStructDecl(node)) {
                params = node.fields || [];
            } else if ('params' in node) {
                params = (node as any).params || [];
            }
            const paramCount = params.length;

            let hasComment = false;
            if (ast.isStructDecl(node) && node.$cstNode) {
                const searchComments = (cst: any): boolean => {
                    if (cst.hiddenTokens && cst.hiddenTokens.some((t: any) => t.text.includes('//'))) return true;
                    if (cst.children) {
                        for (const child of cst.children) {
                            if (searchComments(child)) return true;
                        }
                    }
                    return false;
                };
                hasComment = searchComments(node.$cstNode);
            }

            let forceMultiline = ast.isStructDecl(node) && (paramCount > 5 || hasComment);
            
            if (!forceMultiline && ast.isStructDecl(node) && paramCount > 0 && node.$cstNode) {
                const firstParam = params[0].$cstNode;
                const lastParam = params[paramCount - 1].$cstNode;
                if (firstParam && lastParam) {
                    if (firstParam.range.start.line !== lastParam.range.end.line || 
                        firstParam.range.start.line !== node.$cstNode.range.start.line) {
                        forceMultiline = true;
                    }
                }
            }

            if (leftParen && rightParen) {
                if (forceMultiline) {
                    formatter.interior(leftParen, rightParen).prepend(Formatting.indent());
                    leftParen.append(Formatting.newLine());
                    const commas = formatter.keywords(',');
                    commas.prepend(Formatting.noSpace()); 
                    commas.append(Formatting.newLine());
                    rightParen.prepend(Formatting.newLine());
                } else {
                    leftParen.append(Formatting.noSpace());
                    const commas = formatter.keywords(',');
                    commas.prepend(Formatting.noSpace());
                    commas.append(Formatting.oneSpace());
                    rightParen.prepend(Formatting.noSpace());
                }
            }

            if (ast.isStructDecl(node)) {
                const semi = formatter.keyword(';');
                if (semi) {
                    semi.prepend(Formatting.noSpace());
                }
            }

            if (!ast.isExternSingleStmt(node.$container) && !ast.isClassDecl(node.$container)) {
                formatter.node(node).prepend(Formatting.newLine({ allowMore: true }));
            }
        }

        if (ast.isClassDecl(node)) {
            const leftBrace = formatter.keyword('{');
            const rightBrace = formatter.keyword('}');
            if (leftBrace && rightBrace) {
                formatter.interior(leftBrace, rightBrace).prepend(Formatting.indent());
                leftBrace.prepend(Formatting.oneSpace());
                leftBrace.append(Formatting.newLine());
                rightBrace.prepend(Formatting.newLine());
            }
            formatter.node(node).prepend(Formatting.newLine({ allowMore: true }));
        }
    }
}