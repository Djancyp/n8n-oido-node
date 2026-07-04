import type {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

export class OidoTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Oido Trigger',
		name: 'oidoTrigger',
		icon: 'file:oido.svg',
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["triggerOn"] === "agentDispatch" ? "agent dispatch" : $parameter["event"]}}',
		description: 'Starts the workflow on an Oido Studio event or when an agent dispatches it',
		defaults: { name: 'Oido Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'oidoApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode:
					'={{$parameter["triggerOn"] === "agentDispatch" ? $parameter["responseMode"] : "onReceived"}}',
				responseCode: '={{$parameter["options"]["responseCode"] || 200}}',
				responseData:
					'={{$parameter["triggerOn"] === "agentDispatch" && $parameter["responseMode"] === "lastNode" ? $parameter["responseData"] : undefined}}',
				responseHeaders: '={{$parameter["options"]["responseHeaders"]}}',
				path: 'oido',
			},
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				noDataExpression: true,
				default: 'event',
				options: [
					{
						name: 'Agent Dispatch',
						value: 'agentDispatch',
						description: 'An Oido agent starts this workflow with its trigger_workflow tool',
					},
					{
						name: 'Oido Event',
						value: 'event',
						description: 'An Oido Studio event fires (agent run finished, channel message, ticket created)',
					},
				],
			},

			// ---------------- Oido Event ----------------
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				default: 'agent.run.finished',
				required: true,
				options: [
					{ name: 'Agent Run Finished', value: 'agent.run.finished' },
					{ name: 'Channel Message Received', value: 'channel.message.received' },
				],
				description: 'Which Oido event should start this workflow',
				displayOptions: { show: { triggerOn: ['event'] } },
			},
			{
				displayName: 'Channel Name or ID',
				name: 'channel',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChannels' },
				default: '',
				description:
					'Only trigger for messages on this connected channel. Leave as All Channels to trigger for every channel. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { triggerOn: ['event'], event: ['channel.message.received'] } },
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents' },
				default: '',
				description:
					'Only trigger for this agent. Leave empty to trigger for all agents. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { triggerOn: ['event'], event: ['agent.run.finished'] } },
			},

			// ---------------- Agent Dispatch ----------------
			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				default: 'lastNode',
				options: [
					{
						name: 'Immediately (Fire and Forget)',
						value: 'onReceived',
						description: 'Agent returns immediately without waiting for result',
					},
					{
						name: "Using 'Respond to Agent' Node",
						value: 'responseNode',
						description: 'Response defined in an Oido → Respond to Agent node',
					},
					{
						name: 'When Last Node Finishes',
						value: 'lastNode',
						description: 'Returns data of the last-executed node',
					},
				],
				description: 'When and how to respond to the dispatching agent',
				displayOptions: { show: { triggerOn: ['agentDispatch'] } },
			},
			{
				displayName: 'Response Data',
				name: 'responseData',
				type: 'options',
				displayOptions: { show: { triggerOn: ['agentDispatch'], responseMode: ['lastNode'] } },
				options: [
					{
						name: 'All Entries',
						value: 'allEntries',
						description: 'Returns all the entries of the last node. Always returns an array.',
					},
					{
						name: 'First Entry JSON',
						value: 'firstEntryJson',
						description:
							'Returns the JSON data of the first entry of the last node. Always returns a JSON object.',
					},
					{
						name: 'No Response Body',
						value: 'noData',
						description: 'Returns without a body',
					},
				],
				default: 'firstEntryJson',
				description: 'What data should be returned to the agent',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { triggerOn: ['agentDispatch'] } },
				options: [
					{
						displayName: 'Response Code',
						name: 'responseCode',
						type: 'number',
						typeOptions: { minValue: 100, maxValue: 599 },
						default: 200,
						description: 'The HTTP response code to return',
					},
					{
						displayName: 'Response Headers',
						name: 'responseHeaders',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						description: 'Add headers to the webhook response',
						placeholder: 'Add Response Header',
						options: [
							{
								name: 'entries',
								displayName: 'Entries',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the header',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Value of the header',
									},
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
				return [
					{ name: 'All Agents', value: '' },
					...(Array.isArray(agents) ? agents : []).map((a) => ({
						name: a.agent_name || a.agent_id,
						value: a.agent_id,
					})),
				];
			},
			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const creds = await this.getCredentials('oidoApi');
				const channels = (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
					method: 'GET',
					url: '/v1/channels',
					baseURL: creds.baseUrl as string,
					json: true,
				})) as Array<{ name: string; type: string }>;
				return [
					{ name: 'All Channels', value: '' },
					...(Array.isArray(channels) ? channels : []).map((ch) => ({
						name: ch.type ? `${ch.name} (${ch.type})` : ch.name,
						value: ch.name,
					})),
				];
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Registrations are idempotent upserts on create/delete, so no
				// separate existence check is needed.
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const creds = await this.getCredentials('oidoApi');
				const triggerOn = this.getNodeParameter('triggerOn') as string;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				if (triggerOn === 'agentDispatch') {
					const workflowId = this.getWorkflow().id as string;
					// 'manual' = the editor's "Test workflow" listener (/webhook-test/…).
					// Registered as a separate test row so agents can hit the editor
					// while testing without clobbering the production registration.
					const isTest = this.getMode() === 'manual';
					await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
						method: 'POST',
						url: '/v1/agent-triggers',
						baseURL: creds.baseUrl as string,
						body: { workflow_id: workflowId, target_url: webhookUrl, test: isTest },
						json: true,
					});
					return true;
				}

				const event = this.getNodeParameter('event') as string;
				const agentId = this.getNodeParameter('agentId', '') as string;
				const channel = this.getNodeParameter('channel', '') as string;
				const body: Record<string, unknown> = { event_type: event, target_url: webhookUrl };
				if (agentId) body.agent_id = agentId;
				if (channel) body.channel = channel;
				const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
					method: 'POST',
					url: '/v1/webhooks/subscribe',
					baseURL: creds.baseUrl as string,
					body,
					json: true,
				})) as { id?: string };
				// Bookkeeping is keyed per mode: a test-listener registration
				// ('manual', /webhook-test/… URL) must not overwrite the
				// production subscription id, or deactivation later can't
				// clean up and the subscription row leaks.
				const data = this.getWorkflowStaticData('node');
				const key = this.getMode() === 'manual' ? 'testSubscriptionId' : 'subscriptionId';
				data[key] = res?.id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const creds = await this.getCredentials('oidoApi');
				const triggerOn = this.getNodeParameter('triggerOn') as string;

				if (triggerOn === 'agentDispatch') {
					const workflowId = this.getWorkflow().id as string;
					const isTest = this.getMode() === 'manual';
					try {
						await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
							method: 'DELETE',
							url: `/v1/agent-triggers/${encodeURIComponent(workflowId)}`,
							baseURL: creds.baseUrl as string,
							qs: isTest ? { test: 'true' } : {},
							json: true,
						});
					} catch {
						return false;
					}
					return true;
				}

				const data = this.getWorkflowStaticData('node');
				const key = this.getMode() === 'manual' ? 'testSubscriptionId' : 'subscriptionId';
				try {
					if (data[key]) {
						await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
							method: 'DELETE',
							url: `/v1/webhooks/subscribe/${encodeURIComponent(data[key] as string)}`,
							baseURL: creds.baseUrl as string,
							json: true,
						});
					} else {
						// No stored id (e.g. static data lost) — fall back to
						// delete-by-URL. The webhook URL is mode-specific, so this
						// targets exactly the registration being torn down.
						const qs: Record<string, string> = {
							event_type: this.getNodeParameter('event') as string,
							target_url: this.getNodeWebhookUrl('default') as string,
						};
						const agentId = this.getNodeParameter('agentId', '') as string;
						if (agentId) qs.agent_id = agentId;
						await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
							method: 'DELETE',
							url: '/v1/webhooks/subscribe',
							baseURL: creds.baseUrl as string,
							qs,
							json: true,
						});
					}
				} catch {
					return false;
				}
				delete data[key];
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const triggerOn = this.getNodeParameter('triggerOn') as string;
		const body = this.getBodyData();
		if (triggerOn === 'agentDispatch') {
			const data = body?.data ?? body;
			return {
				workflowData: [this.helpers.returnJsonArray([data as never])],
			};
		}
		return {
			workflowData: [this.helpers.returnJsonArray([body])],
		};
	}
}
