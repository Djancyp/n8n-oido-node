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
		subtitle: '={{$parameter["operation"] === "invoke" ? $parameter["agentId"] : "respond to agent"}}',
		description: 'Run Oido Studio agents and respond to agent-dispatched runs',
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
				],
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
		if (operation === 'respond') {
			return respondToAgent.call(this);
		}
		return runAgent.call(this);
	}
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
