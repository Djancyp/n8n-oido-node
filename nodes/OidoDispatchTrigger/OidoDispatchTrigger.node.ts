import type {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

export class OidoDispatchTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Oido Dispatch Trigger',
		name: 'oidoDispatchTrigger',
		icon: 'file:oido.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["workflowId"]}}',
		description: 'Let agents trigger this workflow with the trigger_workflow tool',
		defaults: { name: 'Oido Dispatch' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'oidoApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'oido-dispatch',
			},
		],
		properties: [],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const creds = await this.getCredentials('oidoApi');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const workflowId = this.getWorkflow().id as string;
				await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
					method: 'POST',
					url: '/v1/agent-triggers',
					baseURL: creds.baseUrl as string,
					body: { workflow_id: workflowId, target_url: webhookUrl },
					json: true,
				});
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const creds = await this.getCredentials('oidoApi');
				const workflowId = this.getWorkflow().id as string;
				try {
					await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
						method: 'DELETE',
						url: `/v1/agent-triggers/${encodeURIComponent(workflowId)}`,
						baseURL: creds.baseUrl as string,
						json: true,
					});
				} catch {
					return false;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as Record<string, unknown>;
		const data = body?.data ?? body;
		return {
			workflowData: [this.helpers.returnJsonArray([data as never])],
		};
	}
}
