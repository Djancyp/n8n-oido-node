import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IN8nHttpResponse,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const TRIGGER_NODE_TYPE = 'n8n-nodes-oido.oidoTrigger';

export class Oido implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Oido',
		name: 'oido',
		icon: 'file:oido.svg',
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"] === "invoke" ? $parameter["agentId"] : $parameter["operation"]}}',
		description:
			'Run Oido Studio agents, respond to agent-dispatched runs, and use Oido embedding, rerank and OCR models',
		defaults: { name: 'Oido' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'oidoApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'invoke',
				options: [
					{
						name: 'Embed Text',
						value: 'embed',
						description: 'Turn text into an embedding vector using the Oido embedding model',
						action: 'Embed text',
					},
					{
						name: 'Extract Text (OCR)',
						value: 'ocrExtract',
						description: 'Run OCR on an image or PDF and return the extracted text (nothing is stored)',
						action: 'Extract text from a file',
					},
					{
						name: 'Get Document',
						value: 'ocrGetDocument',
						description: 'Get an ingested document and its OCR processing status',
						action: 'Get a document',
					},
					{
						name: 'Get Wiki Page',
						value: 'wikiGetPage',
						description: 'Fetch a wiki page by its slug',
						action: 'Get a wiki page',
					},
					{
						name: 'Ingest Document',
						value: 'ocrIngest',
						description:
							'Upload an image or PDF into the Oido document store (async OCR + semantic indexing)',
						action: 'Ingest a document',
					},
					{
						name: 'Ingest to Wiki',
						value: 'wikiIngest',
						description: 'Feed text or a URL into the Oido wiki knowledge pipeline (async)',
						action: 'Ingest to the wiki',
					},
					{
						name: 'Rerank Documents',
						value: 'rerank',
						description: 'Rank documents by relevance to a query using the Oido rerank model',
						action: 'Rerank documents',
					},
					{
						name: 'Respond to Agent',
						value: 'respond',
						description: 'Return data to the agent that dispatched this workflow',
						action: 'Respond to an agent',
					},
					{
						name: 'Run Agent',
						value: 'invoke',
						description: 'Run an Oido agent with a dynamic input and use its answer',
						action: 'Run an agent',
					},
					{
						name: 'Search Documents',
						value: 'ocrSearch',
						description: 'Semantic search over documents previously ingested via Oido OCR',
						action: 'Search documents',
					},
					{
						name: 'Search Wiki',
						value: 'wikiSearch',
						description: 'Semantic search over the org wiki knowledge base',
						action: 'Search the wiki',
					},
				],
			},

			// ---------------- Search Wiki ----------------
			{
				displayName: 'Query',
				name: 'wikiQuery',
				type: 'string',
				default: '',
				required: true,
				description: 'The semantic search query',
				displayOptions: { show: { operation: ['wikiSearch'] } },
			},
			{
				displayName: 'Rerank Results',
				name: 'wikiRerank',
				type: 'boolean',
				default: true,
				description: 'Whether to rerank search results with the Oido rerank model (top 5)',
				displayOptions: { show: { operation: ['wikiSearch'] } },
			},

			// ---------------- Get Wiki Page ----------------
			{
				displayName: 'Slug',
				name: 'wikiSlug',
				type: 'string',
				default: '',
				required: true,
				description: 'The slug of the wiki page to fetch',
				displayOptions: { show: { operation: ['wikiGetPage'] } },
			},

			// ---------------- Ingest to Wiki ----------------
			{
				displayName: 'Source',
				name: 'wikiIngestSource',
				type: 'options',
				options: [
					{ name: 'Text', value: 'text', description: 'Ingest raw text content' },
					{ name: 'URL', value: 'url', description: 'Ingest the content behind a URL' },
				],
				default: 'text',
				displayOptions: { show: { operation: ['wikiIngest'] } },
			},
			{
				displayName: 'Content',
				name: 'wikiContent',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				required: true,
				description: 'The text to ingest (supports expressions)',
				displayOptions: { show: { operation: ['wikiIngest'], wikiIngestSource: ['text'] } },
			},
			{
				displayName: 'URL',
				name: 'wikiSourceUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'The URL to ingest',
				displayOptions: { show: { operation: ['wikiIngest'], wikiIngestSource: ['url'] } },
			},
			{
				displayName: 'Source Type',
				name: 'wikiSourceType',
				type: 'options',
				options: [
					{ name: 'Article', value: 'article' },
					{ name: 'Chat Export', value: 'chat_export' },
					{ name: 'Document', value: 'document' },
					{ name: 'Transcript', value: 'transcript' },
				],
				default: 'article',
				description: 'How the wiki pipeline should treat the content',
				displayOptions: { show: { operation: ['wikiIngest'] } },
			},

			// ---------------- Ingest Document ----------------
			{
				displayName: 'Input Binary Field',
				name: 'docBinaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description:
					'Name of the binary property holding the image or PDF to store. Processing is asynchronous — poll with Get Document.',
				displayOptions: { show: { operation: ['ocrIngest'] } },
			},

			// ---------------- Get Document ----------------
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID returned by Ingest Document',
				displayOptions: { show: { operation: ['ocrGetDocument'] } },
			},

			// ---------------- Embed Text ----------------
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The text to embed (supports expressions)',
				displayOptions: { show: { operation: ['embed'] } },
			},

			// ---------------- Rerank Documents ----------------
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				description: 'The query to rank the documents against',
				displayOptions: { show: { operation: ['rerank'] } },
			},
			{
				displayName: 'Documents',
				name: 'documents',
				type: 'json',
				default: '',
				required: true,
				placeholder: '["first document", "second document"]',
				description: 'JSON array of document strings, or an expression resolving to one',
				displayOptions: { show: { operation: ['rerank'] } },
			},
			{
				displayName: 'Top N',
				name: 'topN',
				type: 'number',
				default: 0,
				description: 'Return only the N most relevant documents. 0 returns all.',
				displayOptions: { show: { operation: ['rerank'] } },
			},

			// ---------------- Extract Text (OCR) ----------------
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property holding the image or PDF (max 10MB)',
				displayOptions: { show: { operation: ['ocrExtract'] } },
			},

			// ---------------- Search Documents ----------------
			{
				displayName: 'Query',
				name: 'searchQuery',
				type: 'string',
				default: '',
				required: true,
				description: 'The semantic search query',
				displayOptions: { show: { operation: ['ocrSearch'] } },
			},
			{
				displayName: 'Top N',
				name: 'searchTopN',
				type: 'number',
				default: 10,
				description: 'Maximum number of results to return',
				displayOptions: { show: { operation: ['ocrSearch'] } },
			},

			// ---------------- Run Agent ----------------
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents' },
				default: '',
				required: true,
				description:
					'The Oido agent to run. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { operation: ['invoke'] } },
			},
			{
				displayName: 'Input',
				name: 'input',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The prompt / message sent to the agent (supports expressions)',
				displayOptions: { show: { operation: ['invoke'] } },
			},
			{
				displayName: 'Wait for Result',
				name: 'wait',
				type: 'boolean',
				default: true,
				description:
					'Whether to wait for the agent to finish and return its answer. Turn off for long runs (fire-and-forget).',
				displayOptions: { show: { operation: ['invoke'] } },
			},

			// ---------------- Respond to Agent ----------------
			{
				displayName: 'Respond With',
				name: 'respondWith',
				type: 'options',
				options: [
					{ name: 'All Incoming Items', value: 'allIncomingItems', description: 'Respond with all input JSON items' },
					{ name: 'First Incoming Item', value: 'firstIncomingItem', description: 'Respond with the first input JSON item' },
					{ name: 'JSON', value: 'json', description: 'Respond with a custom JSON body' },
					{ name: 'No Data', value: 'noData', description: 'Respond with an empty body' },
					{ name: 'Text', value: 'text', description: 'Respond with a simple text message' },
				],
				default: 'firstIncomingItem',
				description: 'The data that should be returned to the agent',
				displayOptions: { show: { operation: ['respond'] } },
			},
			{
				displayName: 'Response Body',
				name: 'responseBody',
				type: 'json',
				default: '',
				description: 'JSON body to return when Respond With is set to JSON',
				displayOptions: { show: { operation: ['respond'], respondWith: ['json'] } },
			},
			{
				displayName: 'Response Text',
				name: 'responseText',
				type: 'string',
				default: '',
				description: 'Text to return when Respond With is set to Text',
				displayOptions: { show: { operation: ['respond'], respondWith: ['text'] } },
			},
			{
				displayName: 'Response Key',
				name: 'responseKey',
				type: 'string',
				default: '',
				placeholder: 'data.output',
				description: 'Key to wrap the response in (e.g. "data.output" wraps items in {data: {output: [...]}})',
				displayOptions: {
					show: { operation: ['respond'], respondWith: ['allIncomingItems', 'firstIncomingItem'] },
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['respond'] } },
				options: [
					{
						displayName: 'Response Code',
						name: 'responseCode',
						type: 'number',
						typeOptions: { minValue: 100, maxValue: 599 },
						default: 200,
						description: 'HTTP status code to return',
					},
					{
						displayName: 'Response Headers',
						name: 'responseHeaders',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						options: [
							{
								name: 'entries',
								displayName: 'Entries',
								values: [
									{ displayName: 'Name', name: 'name', type: 'string', default: '' },
									{ displayName: 'Value', name: 'value', type: 'string', default: '' },
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const creds = await this.getCredentials('oidoApi');
				const agents = (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
					method: 'GET',
					url: '/v1/agents',
					baseURL: creds.baseUrl as string,
					json: true,
				})) as Array<{ agent_id: string; agent_name: string }>;
				return (Array.isArray(agents) ? agents : []).map((a) => ({
					name: a.agent_name || a.agent_id,
					value: a.agent_id,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0) as string;
		switch (operation) {
			case 'respond':
				return respondToAgent.call(this);
			case 'embed':
				return embedText.call(this);
			case 'rerank':
				return rerankDocuments.call(this);
			case 'ocrExtract':
				return ocrExtract.call(this);
			case 'ocrIngest':
				return ocrIngest.call(this);
			case 'ocrGetDocument':
				return ocrGetDocument.call(this);
			case 'ocrSearch':
				return searchDocuments.call(this);
			case 'wikiSearch':
				return wikiSearch.call(this);
			case 'wikiGetPage':
				return wikiGetPage.call(this);
			case 'wikiIngest':
				return wikiIngest.call(this);
			default:
				return runAgent.call(this);
		}
	}
}

// forEachItem runs fn per input item with the shared continue-on-fail handling.
async function forEachItem(
	ctx: IExecuteFunctions,
	fn: (i: number) => Promise<IDataObject>,
): Promise<INodeExecutionData[][]> {
	const items = ctx.getInputData();
	const out: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			out.push({ json: await fn(i), pairedItem: { item: i } });
		} catch (error) {
			if (ctx.continueOnFail()) {
				out.push({
					json: { error: error instanceof Error ? error.message : String(error) },
					pairedItem: { item: i },
				});
				continue;
			}
			throw error;
		}
	}
	return [out];
}

async function embedText(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const text = this.getNodeParameter('text', i) as string;
		if (!text) throw new NodeOperationError(this.getNode(), 'Text is empty', { itemIndex: i });
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'POST',
			url: '/v1/embeddings',
			baseURL: creds.baseUrl as string,
			body: { input: text },
			json: true,
		})) as IDataObject;
	});
}

async function rerankDocuments(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const query = this.getNodeParameter('query', i) as string;
		const raw = this.getNodeParameter('documents', i);
		const topN = this.getNodeParameter('topN', i, 0) as number;

		let documents: unknown = raw;
		if (typeof raw === 'string') {
			try {
				documents = JSON.parse(raw);
			} catch {
				throw new NodeOperationError(this.getNode(), 'Documents is not valid JSON', { itemIndex: i });
			}
		}
		if (!Array.isArray(documents) || documents.some((d) => typeof d !== 'string')) {
			throw new NodeOperationError(this.getNode(), 'Documents must be an array of strings', {
				itemIndex: i,
			});
		}
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'POST',
			url: '/v1/rerank',
			baseURL: creds.baseUrl as string,
			body: { query, documents, top_n: topN },
			json: true,
		})) as IDataObject;
	});
}

// multipartUpload builds a hand-rolled multipart body for a single "file"
// field — keeps the package dependency-free.
function multipartUpload(
	filename: string,
	mimeType: string,
	data: Buffer,
): { body: Buffer; headers: IDataObject } {
	const boundary = '----oido' + Math.random().toString(16).slice(2);
	const head = Buffer.from(
		`--${boundary}\r\n` +
			`Content-Disposition: form-data; name="file"; filename="${filename.replace(/"/g, '')}"\r\n` +
			`Content-Type: ${mimeType}\r\n\r\n`,
	);
	const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
	return {
		body: Buffer.concat([head, data, tail]),
		headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
	};
}

async function ocrExtract(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const propertyName = this.getNodeParameter('binaryPropertyName', i) as string;
		const binary = this.helpers.assertBinaryData(i, propertyName);
		const buffer = await this.helpers.getBinaryDataBuffer(i, propertyName);
		const upload = multipartUpload(binary.fileName || 'file', binary.mimeType || 'application/octet-stream', buffer);

		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'POST',
			url: '/v1/ocr/extract',
			baseURL: creds.baseUrl as string,
			body: upload.body,
			headers: upload.headers,
			json: true,
			// OCR of a large PDF can be slow.
			timeout: 300_000,
		})) as IDataObject;
	});
}

async function ocrIngest(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const propertyName = this.getNodeParameter('docBinaryPropertyName', i) as string;
		const binary = this.helpers.assertBinaryData(i, propertyName);
		const buffer = await this.helpers.getBinaryDataBuffer(i, propertyName);
		const upload = multipartUpload(binary.fileName || 'file', binary.mimeType || 'application/octet-stream', buffer);

		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'POST',
			url: '/v1/ocr/ingest',
			baseURL: creds.baseUrl as string,
			body: upload.body,
			headers: upload.headers,
			json: true,
		})) as IDataObject;
	});
}

async function ocrGetDocument(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const documentId = this.getNodeParameter('documentId', i) as string;
		if (!documentId) {
			throw new NodeOperationError(this.getNode(), 'Document ID is empty', { itemIndex: i });
		}
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'GET',
			url: `/v1/ocr/documents/${encodeURIComponent(documentId)}`,
			baseURL: creds.baseUrl as string,
			json: true,
		})) as IDataObject;
	});
}

async function wikiSearch(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const query = this.getNodeParameter('wikiQuery', i) as string;
		const rerank = this.getNodeParameter('wikiRerank', i, true) as boolean;
		if (!query) throw new NodeOperationError(this.getNode(), 'Query is empty', { itemIndex: i });
		const results = await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'GET',
			url: '/v1/wiki/search',
			baseURL: creds.baseUrl as string,
			qs: { q: query, rerank: rerank ? 'true' : 'false' },
			json: true,
		});
		return (Array.isArray(results) ? { results } : results) as IDataObject;
	});
}

async function wikiGetPage(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const slug = this.getNodeParameter('wikiSlug', i) as string;
		if (!slug) throw new NodeOperationError(this.getNode(), 'Slug is empty', { itemIndex: i });
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'GET',
			url: `/v1/wiki/${encodeURIComponent(slug)}`,
			baseURL: creds.baseUrl as string,
			json: true,
		})) as IDataObject;
	});
}

async function wikiIngest(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const source = this.getNodeParameter('wikiIngestSource', i) as string;
		const sourceType = this.getNodeParameter('wikiSourceType', i, 'article') as string;
		const body: IDataObject = { source_type: sourceType };
		if (source === 'url') {
			const url = this.getNodeParameter('wikiSourceUrl', i) as string;
			if (!url) throw new NodeOperationError(this.getNode(), 'URL is empty', { itemIndex: i });
			body.source_uri = url;
		} else {
			const content = this.getNodeParameter('wikiContent', i) as string;
			if (!content) throw new NodeOperationError(this.getNode(), 'Content is empty', { itemIndex: i });
			body.content = content;
		}
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'POST',
			url: '/v1/wiki/ingest',
			baseURL: creds.baseUrl as string,
			body,
			json: true,
		})) as IDataObject;
	});
}

async function searchDocuments(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const creds = await this.getCredentials('oidoApi');
	return forEachItem(this, async (i) => {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const topN = this.getNodeParameter('searchTopN', i, 10) as number;
		if (!query) throw new NodeOperationError(this.getNode(), 'Query is empty', { itemIndex: i });
		const results = await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
			method: 'GET',
			url: '/v1/ocr/search',
			baseURL: creds.baseUrl as string,
			qs: { q: query, top_n: topN },
			json: true,
		});
		return (Array.isArray(results) ? { results } : results) as IDataObject;
	});
}

async function runAgent(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const creds = await this.getCredentials('oidoApi');
	const out: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		const agentId = this.getNodeParameter('agentId', i) as string;
		const input = this.getNodeParameter('input', i) as string;
		const wait = this.getNodeParameter('wait', i, true) as boolean;

		if (!agentId) throw new NodeOperationError(this.getNode(), 'No agent selected', { itemIndex: i });

		try {
			const response = await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
				method: 'POST',
				url: `/v1/agents/${encodeURIComponent(agentId)}/invoke`,
				baseURL: creds.baseUrl as string,
				body: { input, wait },
				json: true,
				// Agent runs can take minutes; match the server's 10-min cap instead
				// of the HTTP helper's default timeout.
				timeout: 600_000,
			});
			out.push({ json: response, pairedItem: { item: i } });
		} catch (error) {
			if (this.continueOnFail()) {
				out.push({
					json: { error: error instanceof Error ? error.message : String(error) },
					pairedItem: { item: i },
				});
				continue;
			}
			throw error;
		}
	}

	return [out];
}

async function respondToAgent(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const connectedNodes = this.getParentNodes(this.getNode().name);

	if (!connectedNodes.some((n) => n.type === TRIGGER_NODE_TYPE)) {
		throw new NodeOperationError(
			this.getNode(),
			new Error('No Oido Trigger node found in the workflow'),
			{ description: 'Add an Oido Trigger node (Agent Dispatch) before this node.' },
		);
	}

	const respondWith = this.getNodeParameter('respondWith', 0) as string;
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;

	const headers: IDataObject = {};
	if (options.responseHeaders) {
		for (const h of (options.responseHeaders as IDataObject).entries as IDataObject[]) {
			headers[(h.name as string)?.toLowerCase()] = h.value;
		}
	}

	const statusCode = (options.responseCode as number) || 200;
	let responseBody: IN8nHttpResponse;

	if (respondWith === 'firstIncomingItem') {
		const key = options.responseKey as string;
		responseBody = key ? { [key]: items[0]?.json } : (items[0]?.json ?? {});
	} else if (respondWith === 'allIncomingItems') {
		const jsonItems = items.map((i) => i.json);
		const key = options.responseKey as string;
		responseBody = key ? { [key]: jsonItems } : jsonItems;
	} else if (respondWith === 'json') {
		const raw = this.getNodeParameter('responseBody', 0, '') as string;
		try {
			responseBody = raw ? JSON.parse(raw) : {};
		} catch {
			throw new NodeOperationError(this.getNode(), new Error('Invalid JSON in Response Body'));
		}
	} else if (respondWith === 'text') {
		responseBody = this.getNodeParameter('responseText', 0, '') as string;
	} else {
		responseBody = {};
	}

	this.sendResponse({ body: responseBody, headers, statusCode });
	return [items];
}
