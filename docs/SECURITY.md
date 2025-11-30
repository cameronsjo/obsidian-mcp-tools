# Security Considerations

**This tool exposes your entire Obsidian vault over HTTP.** Read this document carefully before deploying.

## Threat Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR PERSONAL KNOWLEDGE                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐  │
│  │  Passwords│ │  API Keys │ │  Personal │ │ Work Secrets    │  │
│  │  (maybe)  │ │  (maybe)  │ │  Journals │ │ (definitely)    │  │
│  └───────────┘ └───────────┘ └───────────┘ └─────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │  Obsidian Vault │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Local REST API  │  ← HTTP endpoint
                    │    Plugin       │    (no TLS by default)
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   MCP Server    │  ← Exposes vault operations
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         [Intended]    [Unintended]   [Catastrophic]
         MCP Client    Local Access   Public Internet
```

## Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Public internet exposure | **CRITICAL** | Never expose publicly. Use VPN/Tailscale. |
| Local network exposure | High | Bind to localhost only. Use firewall rules. |
| No authentication | High | API key is transmitted in plaintext over HTTP. |
| No encryption | High | All vault content readable via network sniffing. |
| Scope bypass | Medium | Scopes are advisory, not a security boundary. |
| Path traversal | Medium | Mitigated but defense-in-depth recommended. |
| Plugin vulnerabilities | Medium | Keep Local REST API plugin updated. |

## Critical Warnings

### DO NOT Expose Publicly

**Never, under any circumstances, expose the Local REST API or MCP server to the public internet.**

This is not a hardened production service. It is a local development tool. Public exposure means:

- Complete read access to your vault (journals, credentials, work secrets)
- Write access to modify or corrupt your notes
- Delete access to destroy your knowledge base
- No rate limiting, brute force protection, or audit logging

If you need remote access, use:

- **Tailscale** - Zero-config mesh VPN
- **WireGuard** - Fast, modern VPN
- **SSH tunnel** - `ssh -L 27123:localhost:27123 your-server`

### API Key is Not Real Security

The Local REST API's API key:

- Is transmitted in plaintext (no TLS)
- Can be sniffed on the local network
- Provides no protection against localhost access
- Is a convenience feature, not a security boundary

### Scopes are Authorization, Not Security

The MCP scope system (`readonly`, `editor`, `full`, `admin`) is designed to:

- Prevent accidental destructive operations
- Limit blast radius of misconfigured clients
- Provide defense-in-depth

It is NOT designed to:

- Protect against malicious actors
- Replace proper authentication
- Serve as a security boundary for untrusted clients

## Secure Deployment Checklist

### Local Development (Recommended)

```
[x] Obsidian running on localhost
[x] Local REST API bound to 127.0.0.1 only
[x] MCP server accessed via stdio (not network)
[x] No port forwarding or firewall exceptions
```

### Home Server (Proceed with Caution)

```
[ ] Server on isolated VLAN or network segment
[ ] Firewall rules restricting access to specific IPs
[ ] VPN required for any remote access
[ ] Regular security updates for all components
[ ] Backup strategy for vault data
[ ] Monitoring for unauthorized access attempts
```

### Cloud/Public (DO NOT DO THIS)

```
[!!!] STOP. DO NOT PROCEED.
[!!!] There is no secure way to expose this publicly.
[!!!] Use a VPN. Seriously.
```

## Network Binding

### Local REST API Plugin

Configure the plugin to bind to localhost only:

- Host: `127.0.0.1` (NOT `0.0.0.0`)
- This prevents access from other machines on your network

### Firewall Rules

Even with localhost binding, add firewall rules as defense-in-depth:

```bash
# macOS - block external access to port 27123
sudo pfctl -e
echo "block in on ! lo0 proto tcp to any port 27123" | sudo pfctl -f -

# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 27123 ! -i lo -j DROP

# Linux (ufw)
sudo ufw deny in on any to any port 27123
```

## Sensitive Content

Consider what's in your vault:

- **Credentials** - API keys, passwords, tokens
- **Personal information** - Journals, health notes, financial data
- **Work secrets** - Proprietary information, client data
- **Authentication tokens** - OAuth tokens, session cookies

### Recommendations

1. **Use separate vaults** - Keep sensitive content in a vault without MCP access
2. **Use `mcp-protected` tags** - Prevent deletion of critical files
3. **Use `mcp-readonly` tags** - Prevent modification of sensitive files
4. **Use `mcp-hidden` tags** - Hide files from listing (future feature)
5. **Regular audits** - Review what's accessible via MCP

## Incident Response

If you suspect unauthorized access:

1. **Immediately** disable the Local REST API plugin
2. **Rotate** any credentials stored in your vault
3. **Review** Obsidian sync history for unauthorized changes
4. **Audit** your network for how access was gained
5. **Report** vulnerabilities to the appropriate projects

## Reporting Security Issues

- **This project**: Open a private security advisory on GitHub
- **Local REST API plugin**: Contact the plugin author
- **Obsidian**: security@obsidian.md

## Summary

This tool is powerful and useful, but it's essentially **leaving your diary open on a park bench with a "please don't read" sign**. The sign might deter some people, but it's not a lock.

When configured incorrectly, anyone on your network (or worse, the internet) can:

- **Read** everything you've ever written
- **Modify** your notes without you knowing
- **Delete** your entire knowledge base

```
┌────────────────────────────────────────────┐
│                                            │
│   Your vault is your second brain.         │
│   Protect it like you would your first.    │
│                                            │
└────────────────────────────────────────────┘
```
