grammar WhiteLanguage

entry Program:
    statements+=Statement*;

// ==========================================
// Statements
// ==========================================
Statement:
    Import |
    DeclarationStmt | ControlStmt |
    SpecialStmt | ExpressionStmt | Block | EmptyStmt;

DeclarationStmt:
    (VariableDecl | ExternSingleStmt) ';' |
    (FunctionDecl | StructDecl | ExternBlock); 

ControlStmt:
    IfStmt | WhileStmt | ForStmt;

SpecialStmt:
    (ReturnStmt | BreakStmt | ContinueStmt) ';';

ExpressionStmt:
    Expression ';';

EmptyStmt:
    {infer EmptyStmt} ';';

Block:
    leftBrace='{' statements+=Statement* rightBrace='}';

// ==========================================
// Declarations
// ==========================================
type Declaration = VariableDecl | FunctionDecl | StructDecl | ExternFuncDecl | ForVarDecl | Param | SymbolImport | FileImport;

VariableDecl:
    {infer VariableDecl} kind=('let' | 'const') (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ID '->' type=TypeReference ('=' value=Expression)?;

ForVarDecl:
    {infer ForVarDecl} (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ID '->' type=TypeReference ('=' value=Expression)?;

FunctionDecl:
    {infer FunctionDecl} 'func' name=ID '(' (params+=Param (',' params+=Param)*)? (','? varArgs?='...')? ')' ('->' returnType=TypeReference) body=Block;

Param:
    {infer Param} (isPtr?='ptr' ('*' ptrLevel=INT)?)? name=ID '->' type=TypeReference;

StructDecl:
    {infer StructDecl} 'struct' name=ID '(' (fields+=Param (',' fields+=Param)*)? ')' (body=Block)? ';'? ;

ExternBlock:
    {infer ExternBlock} 'extern' abi=STRING leftBrace='{' (funcs+=ExternFuncDecl ';')* rightBrace='}';

ExternSingleStmt:
    {infer ExternSingleStmt} 'extern' func=ExternFuncDecl ('from' abi=STRING)?;

ExternFuncDecl:
    {infer ExternFuncDecl} 'func' name=ID '(' (params+=Param (',' params+=Param)*)? (','? varArgs?='...')? ')' ('->' returnType=TypeReference)?;

// ==========================================
// Imports
// ==========================================
Import:
    'import' (
        (fileImports+=FileImport (',' fileImports+=FileImport)*) 
        | 
        (symbolImports+=SymbolImport (',' symbolImports+=SymbolImport)* 'from' fromPath=STRING)
    ) ';'?;

FileImport:
    path=STRING ('as' name=ID)?;

SymbolImport:
    importedElement=[Declaration:ID] ('as' name=ID)?;

// ==========================================
// Control Flow
// ==========================================
IfStmt: {infer IfStmt} 'if' condition=Expression thenBlock=Block ('else' (elseIf=IfStmt | elseBlock=Block))? ';'? ;
WhileStmt: {infer WhileStmt} 'while' '(' condition=Expression ')' body=Block ';'? ;
ForStmt: {infer ForStmt} 'for' '(' (init=(VariableDecl | ForVarDecl | Expression))? ';' condition=Expression ';' (step=Expression)? ')' body=Block ';'? ;

ReturnStmt: {infer ReturnStmt} 'return' (value=Expression)?;
BreakStmt: {infer BreakStmt} 'break';
ContinueStmt: {infer ContinueStmt} 'continue';

// ==========================================
// Type References
// ==========================================
TypeReference: PointerType | VectorType | FunctionType | PrimitiveType | NamedType;
PointerType: {infer PointerType} 'ptr' ('*' level=INT)? elementType=TypeReference;
VectorType: {infer VectorType} 'Vector' ('(' elementType=TypeReference ')')?;
FunctionType: {infer FunctionType} 'Function' ('(' returnType=TypeReference ')')?;
PrimitiveType: {infer PrimitiveType} name=('Int' | 'Float' | 'String' | 'Bool' | 'Void' | 'Byte' | 'Long' | 'Struct');
NamedType: {infer NamedType} ref=[Declaration:ID];

// ==========================================
// Expressions
// ==========================================
Expression: Assignment;

Assignment infers Expression: 
    LogicalOr ({infer Assignment.left=current} op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=') right=Assignment)?;

LogicalOr infers Expression: 
    LogicalAnd ({infer BinaryExpression.left=current} op='||' right=LogicalAnd)*;

LogicalAnd infers Expression: 
    Equality ({infer BinaryExpression.left=current} op='&&' right=Equality)*;

Equality infers Expression: 
    Relational ({infer BinaryExpression.left=current} (op='==' | op='!=' | (op='is' isNot?='!'?) | op='in') right=Relational)*;

Relational infers Expression: 
    Additive ({infer BinaryExpression.left=current} op=('<' | '>' | '<=' | '>=') right=Additive)*;

Additive infers Expression: 
    Multiplicative ({infer BinaryExpression.left=current} op=('+' | '-') right=Multiplicative)*;

Multiplicative infers Expression: 
    Power ({infer BinaryExpression.left=current} op=('*' | '/' | '%') right=Power)*;

Power infers Expression: 
    Unary ({infer BinaryExpression.left=current} op='**' right=Unary)*;

Unary infers Expression:
    {infer UnaryExpression} op=('!' | '-' | '+' | 'ref') value=Unary |
    {infer DerefExpression} 'deref' ('*' level=INT)? value=Unary |
    Postfix;

Postfix infers Expression:
    Primary (
        {infer MemberAccess.receiver=current} '.' member=ID |
        {infer ArrayAccess.receiver=current} '[' index=Expression ']' |
        {infer FunctionCall.caller=current} '(' (args+=Argument (',' args+=Argument)*)? ')' |
        {infer PostfixUpdate.operand=current} op=('++' | '--')
    )*;

Primary infers Expression:
    '(' Expression ')' |
    {infer Literal} value=(INT | FLOAT | STRING | BOOLEAN | 'null' | 'nullptr') |
    'this' {infer ThisExpression} |
    {infer VectorLiteral} '[' (elements+=Expression (',' elements+=Expression)*)? ']' |
    {infer Reference} ref=[Declaration:ID];

Argument: (name=ID '=')? value=Expression;

// ==========================================
// Terminals
// ==========================================
terminal BOOLEAN returns boolean: 'true' | 'false';
terminal FLOAT returns number: /[0-9]*\.[0-9]+/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"/;
terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;

hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;