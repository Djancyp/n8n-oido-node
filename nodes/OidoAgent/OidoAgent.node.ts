import type {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class OidoAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Oido Agent',
    name: 'oidoAgent',
    icon: 'file:oido.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["agentId"]}}',
    description: 'Run an Oido Studio agent and use its answer',
    defaults: { name: 'Oido Agent' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'oidoApi', required: true }],
    properties: [
      {
        displayName: 'Agent',
        name: 'agentId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getAgents' },
        default: '',
        required: true,
        description: 'The Oido agent to run. Choose from the list.',
      },
      {
        displayName: 'Input',
        name: 'input',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        description: 'The prompt / message sent to the agent (supports expressions).',
      },
      {
        displayName: 'Wait for Result',
        name: 'wait',
        type: 'boolean',
        default: true,
        description:
          'Whether to wait for the agent to finish and return its answer. Turn off for long runs (fire-and-forget).',
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
    const items = this.getInputData();
    const creds = await this.getCredentials('oidoApi');
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const agentId = this.getNodeParameter('agentId', i) as string;
      const input = this.getNodeParameter('input', i) as string;
      const wait = this.getNodeParameter('wait', i, true) as boolean;

      if (!agentId) throw new NodeOperationError(this.getNode(), 'No agent selected', { itemIndex: i });

      const response = await this.helpers.httpRequestWithAuthentication.call(this, 'oidoApi', {
        method: 'POST',
        url: `/v1/agents/${encodeURIComponent(agentId)}/invoke`,
        baseURL: creds.baseUrl as string,
        body: { input, wait },
        json: true,
      });

      out.push({ json: response, pairedItem: { item: i } });
    }

    return [out];
  }
}
