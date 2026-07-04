import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class OidoApi implements ICredentialType {
  name = 'oidoApi';

  displayName = 'Oido API';

  documentationUrl = 'https://oidostudio.com/docs';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://oido:5577',
      description:
        'Oido Core base URL. Inside the same Docker network use http://oido:5577; otherwise the public API URL.',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Org API key from Oido Studio → Settings → API Keys (starts with oido_sk_).',
    },
  ];

  // Sent on every request made by nodes using this credential.
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  // "Test" button in the credential UI.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/v1/agents',
      method: 'GET',
    },
  };
}
