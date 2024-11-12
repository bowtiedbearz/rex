import type { DefinitionsService, ListOfStrings } from "./compose_schema.ts";

export interface Ssh {
    user?: string;
    keys?: string[];
    port?: number;
    config?: boolean
}

export interface PortDefintion {
    target: number;
    published: number;
    protocol?: 'tcp' | 'udp';
    mode?: 'ingress' | 'host';
    name?: string;
    app_protocol?: string;
}

export interface RexPortDefinition extends PortDefintion {
    rule?: string;
    entrypoint?: string;
}

export type ComposeDict = { 
    [k: string]: string | number | boolean | null;
}

export interface RexService extends DefinitionsService {
    ports?: ListOfStrings |  PortDefintion[];
    dns_provider?: 'cloudflare' | 'route53' | 'azure';
    name: string
    zonefile?: string;
    fqdn?: string | string[];
    certprovider?: 'lets-encrypt' | 'self-signed' | 'zerossl';
    restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
    proxy?: 'traefik' | 'none';
}