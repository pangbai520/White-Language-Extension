import { startLanguageServer } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
import { createWhiteLanguageServices } from 'white-language';


const connection = createConnection(ProposedFeatures.all);
const { shared } = createWhiteLanguageServices({ connection, ...NodeFileSystem });
startLanguageServer(shared);
