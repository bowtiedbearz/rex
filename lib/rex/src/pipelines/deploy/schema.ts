import type { DefinitionsService, ListOfStrings } from "./docker/compose_schema.ts";

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

const portMap = new Map<number, string>();
portMap.set(80, 'http');
portMap.set(443, 'https');
portMap.set(22, 'ssh');
portMap.set(3306, 'mysql');
portMap.set(5432, 'postgres');
portMap.set(27017, 'mongodb');
portMap.set(6379, 'redis');
portMap.set(8080, 'http');
portMap.set(8081, 'http');
portMap.set(8082, 'http');
portMap.set(3000, 'http');
portMap.set(3001, 'http');
portMap.set(5000, 'http');
portMap.set(1433, 'mssql');
portMap.set(1521, 'oracle');
portMap.set(53, 'dns');
portMap.set(389, 'ldap');
portMap.set(636, 'ldaps');
portMap.set(8086, 'influxdb');
portMap.set(5672, 'amqp');
portMap.set(8200, 'vault');
portMap.set(9092, 'kafka');
portMap.set(514, 'syslog');
portMap.set(5140, 'syslog');
portMap.set(51820, 'wireguard');

export function createRexService(service: RexService) : DefinitionsService {
    const serviceName = service.name;
    const dockerService : DefinitionsService = Object.assign({}, service);
    const removeKeys = ['dns_provider', 'zonefile', 'fqdn',  'proxy', 'ports', 'name'];
    for(const key of removeKeys) {
        delete (dockerService as Record<string, unknown>)[key];
    }
    dockerService.restart ??= 'unless-stopped';
    dockerService.container_name ??= serviceName;
    dockerService.hostname ??= serviceName;
    const proxy = service.proxy ?? 'traefik';
    const ports = service.ports ?? [];
    
    const hasProxy = service.proxy !== 'none';

    const normalizeLabels : ComposeDict = {};  
    const rexPorts : RexPortDefinition[] = [];
    const dockerPorts : PortDefintion[] = [];
    const rexPortKeys = ['rule', 'tls', 'entrypoint'];
    
    for(const port of ports) {
        if (typeof port === 'string') {
           const parts = port.split(':');
           let target : number = 80;
           let published : number = 80;
           let protocol : 'tcp' | 'udp' = 'tcp';
           let name : undefined | string;
           let entrypoint : undefined | string;
           switch(parts.length) {
                case 1:
                    target = parseInt(parts[0]);                        
                    break;

                case 2:
                    target = parseInt(parts[0]);
                    published = parseInt(parts[1]);

                    break;

                case 3:
                    {
                        target = parseInt(parts[0]);
                        published = parseInt(parts[1]);
                        protocol = parts[2] as 'tcp' | 'udp';
                    }

                    break;
                
                default:
                    throw new Error(`Invalid port definition: ${port}`);
            }

            if (portMap.has(target)) {
                name = portMap.get(target);
                entrypoint = name;
            } else {
                entrypoint = "https";
                name = `https-${published}`;
            }

            dockerPorts.push({
                target,
                published,
                protocol,
                name
            });
            rexPorts.push({
                target,
                published,
                protocol,
                entrypoint,
                rule: service.fqdn === undefined ? undefined : `Host(\`${service.fqdn}\`)`
            });
        } else {
            rexPorts.push(port);
            const dockerPort = Object.assign({}, port) as PortDefintion
            for(const key of rexPortKeys) {
                delete (dockerPort as unknown as Record<string, unknown>)[key];
            }
            dockerPorts.push(dockerPort);
        }
    }

    if (hasProxy && proxy === 'traefik') {
        normalizeLabels['traefik.enable'] = true;
        for(const port of rexPorts) {
            const { name, target, protocol, rule, entrypoint } = port;
            
            if (entrypoint === "https" || target === 443 || portMap.get(target) === 'http') {
                normalizeLabels[`trafik.http.routers.${serviceName}.service`] = serviceName;
                if (rule) {
                    normalizeLabels[`traefik.http.routers.${serviceName}.rule`] = rule 
                }

                normalizeLabels[`trafik.http.routers.${serviceName}.entrypoints`] = "https";
                
                normalizeLabels[`traefik.http.routers.${serviceName}.tls`] = true;
                if (service.certprovider && service.certprovider !== 'self-signed') {
                    normalizeLabels[`traefik.http.routers.${serviceName}.tls.certresolver`] = service.certprovider;
                }
                if (target !== 80 && target !== 443) {
                    normalizeLabels[`traefik.http.services.${serviceName}.loadbalancer.server.port`] = target
                }

            } else {
                if (protocol === 'tcp' || !protocol) {
                    normalizeLabels[`trafik.tcp.routers.${serviceName}.service`] = serviceName;
               
                    if (rule) {
                        normalizeLabels[`traefik.tcp.routers.${serviceName}.rule`] = rule 
                    }
                    normalizeLabels[`trafik.tcp.routers.${serviceName}.entrypoints`] = entrypoint ?? name ?? serviceName
                    if (service.certprovider) {
                        normalizeLabels[`traefik.tcp.routers.${serviceName}.tls`] = true;
                        if (service.certprovider && service.certprovider !== 'self-signed') {
                            normalizeLabels[`traefik.tcp.routers.${serviceName}.tls.certresolver`] = service.certprovider;
                        }
                    }
    
                    normalizeLabels[`traefik.tcp.services.${serviceName}.loadbalancer.server.port`] = target
                } else {
                    normalizeLabels[`trafik.udp.routers.${serviceName}.service`] = serviceName;
               
                    if (rule) {
                        normalizeLabels[`traefik.udp.routers.${serviceName}.rule`] = rule 
                    }
                    normalizeLabels[`trafik.udp.routers.${serviceName}.entrypoints`] = entrypoint ?? name ?? serviceName;
                    if (service.certprovider) {
                        normalizeLabels[`traefik.udp.routers.${serviceName}.tls`] = true;
                        if (service.certprovider && service.certprovider !== 'self-signed') {
                            normalizeLabels[`traefik.udp.routers.${serviceName}.tls.certresolver`] = service.certprovider;
                        }
                    }
    
                    normalizeLabels[`traefik.udp.services.${serviceName}.loadbalancer.server.port`] = target
                }
                
            }
           
        }
    } else {
        dockerService.ports = dockerPorts;
    }

    if (Array.isArray(service.labels)) {
        for(const label of service.labels) {
            const [key, value] = label.split('=');
            normalizeLabels[key] = value;
        }
    }
 
    return dockerService;
}