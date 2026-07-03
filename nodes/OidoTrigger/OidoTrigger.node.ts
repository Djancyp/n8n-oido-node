import type {
  IHookFunctions,
  IWebhookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
} from 'n8n-workflow';

export class OidoTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Oido Trigger',
    name: 'oidoTrigger',
    icon: 'file:oido.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description: 'Starts the workflow when an Oido Studio event fires',
    defaults: { name: 'Oido Trigger' },
    inputs: [],
    outputs: ['main'],
    credentials: [{ name: 'oidoApi', required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'oido',
      },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        default: 'agent.run.finished',
        required: true,
        options: [
          { name: 'Agent Run Finished', value: 'agent.run.finished' },
          { name: 'Channel Message Received', value: 'channel.message.received' },
          { name: 'Ticket Created', value: 'ticket.created' },
        ],
        description: 'Which Oido event should start this workflow',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        // We manage subscriptions by (event, url) on create/delete, so no
        // separate existence check is needed.
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const creds = await this.getCredentials('oidoApi');
        const event = this.getNodeParameter('event') as string;
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
          method: 'POST',
          url: '/v1/webhooks/subscribe',
          baseURL: creds.baseUrl as string,
          body: { event_type: event, target_url: webhookUrl },
          json: true,
        })) as { id?: string };
        const data = this.getWorkflowStaticData('node');
        data.subscriptionId = res?.id;
        data.event = event;
        data.webhookUrl = webhookUrl;
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const creds = await this.getCredentials('oidoApi');
        const data = this.getWorkflowStaticData('node');
        try {
          if (data.subscriptionId) {
            await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
              method: 'DELETE',
              url: `/v1/webhooks/subscribe/${encodeURIComponent(data.subscriptionId as string)}`,
              baseURL: creds.baseUrl as string,
              json: true,
            });
          } else if (data.event && data.webhookUrl) {
            await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
              method: 'DELETE',
              url: '/v1/webhooks/subscribe',
              baseURL: creds.baseUrl as string,
              qs: { event_type: data.event as string, target_url: data.webhookUrl as string },
              json: true,
            });
          }
        } catch {
          return false;
        }
        delete data.subscriptionId;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData();
    return {
      workflowData: [this.helpers.returnJsonArray([body])],
    };
  }
}
