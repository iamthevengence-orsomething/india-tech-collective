/**
 * The toolkit registry — 27 open-source tools, curated. Extracted verbatim
 * from the original landing page; content unchanged in the redesign.
 */
export interface Tool { name: string; cat: string; url: string; desc: string; proof: string; proofKind: string; caveat?: string }

export const CATS: Record<string, { label: string; color?: string }> = {
  mesh:      { label:"Offline / Mesh",   },
  messaging: { label:"Secure Messaging", },
  circum:    { label:"Circumvention",    },
  evidence:  { label:"Evidence",         },
  monitor:   { label:"Monitoring",       },
  organize:  { label:"Organizing",       },
  whistle:   { label:"Whistleblowing",   },
};

export const TOOLS: Tool[] = [
  // Offline / mesh — works during internet shutdowns
  { name:"Briar", cat:"mesh", url:"https://briarproject.org",
    desc:"P2P encrypted messenger over Bluetooth/Wi-Fi — no servers, so there's nothing to shut down.",
    proof:"Became a lifeline during Iran's January 2026 shutdown that cut off 85M+ people.", proofKind:"proof" },
  { name:"Bitchat", cat:"mesh", url:"https://bitchat.free",
    desc:"Bluetooth mesh chat — no internet, no SIM card needed.",
    proof:"Downloads in Nepal jumped ~1,400% in five days during the Sept 2025 Gen-Z protests; Nepal briefly became its largest user base.", proofKind:"proof" },
  { name:"Meshtastic", cat:"mesh", url:"https://meshtastic.org",
    desc:"Open-source LoRa long-range mesh network for off-grid text messaging on cheap radios.",
    proof:"Kilometres of range with no tower, no SIM, and no one to ask — off-grid by design.", proofKind:"why" },
  { name:"Bridgefy", cat:"mesh", url:"https://bridgefy.me",
    desc:"Bluetooth mesh messaging for when the internet disappears.",
    proof:"Used during shutdowns in Hong Kong, Myanmar, and elsewhere.", proofKind:"proof",
    caveat:"Researchers found serious security flaws in earlier versions — prefer Briar for sensitive comms." },

  // Secure messaging
  { name:"Signal", cat:"messaging", url:"https://signal.org",
    desc:"The gold-standard open-source end-to-end encrypted messenger.",
    proof:"Its encryption protocol is so trusted that even WhatsApp runs on it.", proofKind:"proof" },
  { name:"Element / Matrix", cat:"messaging", url:"https://element.io",
    desc:"Decentralized, self-hostable encrypted chat rooms.",
    proof:"Self-hostable means no single company can switch your community off.", proofKind:"why" },
  { name:"Delta Chat", cat:"messaging", url:"https://delta.chat",
    desc:"Encrypted messaging that travels over ordinary email servers.",
    proof:"It rides the email network — blocking it means blocking email itself.", proofKind:"why" },

  // Censorship circumvention
  { name:"Tor Browser", cat:"circum", url:"https://www.torproject.org",
    desc:"Anonymous browsing; access blocked sites.",
    proof:"Two decades of audits and daily use by journalists and readers of blocked news worldwide.", proofKind:"proof" },
  { name:"Snowflake", cat:"circum", url:"https://snowflake.torproject.org",
    desc:"Run a browser extension and become a proxy helping censored users reach Tor.",
    proof:"Your everyday browser tab can become someone else's way out — no technical skill required.", proofKind:"why" },
  { name:"Psiphon", cat:"circum", url:"https://psiphon.ca",
    desc:"Open-source VPN/proxy tunnel built to defeat filtering.",
    proof:"Purpose-built to defeat national-scale filtering, and battle-tested for years.", proofKind:"why" },
  { name:"Ceno Browser", cat:"circum", url:"https://censorship.no",
    desc:"P2P web browser that shares cached pages across users.",
    proof:"Pages you've already read travel peer-to-peer to people who can't reach them.", proofKind:"why" },

  // Documenting & verifying evidence
  { name:"Tella", cat:"evidence", url:"https://tella-app.org",
    desc:"Camera app that encrypts and hides photos/videos.",
    proof:"Built for human-rights documentation — evidence stays hidden even if the phone is taken.", proofKind:"why" },
  { name:"ProofMode", cat:"evidence", url:"https://proofmode.org",
    desc:"Guardian Project tool that adds cryptographic metadata to photos and videos.",
    proof:"Turns any phone photo into verifiable evidence — signed, timestamped, tamper-evident.", proofKind:"why" },
  { name:"eyeWitness to Atrocities", cat:"evidence", url:"https://www.eyewitness.global",
    desc:"Court-ready verified footage capture.",
    proof:"Designed with lawyers so footage stands up in court, not just on social media.", proofKind:"why" },

  // Monitoring shutdowns & censorship
  { name:"OONI Probe", cat:"monitor", url:"https://ooni.org",
    desc:"Run a test, contribute open data on what's blocked in your network.",
    proof:"Every test you run becomes public, citable evidence of censorship.", proofKind:"why" },
  { name:"internetshutdowns.in", cat:"monitor", url:"https://internetshutdowns.in",
    desc:"India's live internet-shutdown tracker, maintained by SFLC.in.",
    proof:"The tracker behind the headline — every Indian shutdown, logged and public.", proofKind:"proof" },
  { name:"NetBlocks", cat:"monitor", url:"https://netblocks.org",
    desc:"Real-time global internet observatory.",
    proof:"Often the first alert the world sees when a country goes dark.", proofKind:"proof" },

  // Organizing & civic participation
  { name:"Ushahidi", cat:"organize", url:"https://www.ushahidi.com",
    desc:"Open-source crowdsourced mapping and reporting.",
    proof:"Born from crisis response — mapping what's really happening when official channels won't.", proofKind:"proof" },
  { name:"Loomio", cat:"organize", url:"https://www.loomio.org",
    desc:"Collaborative decision-making for groups.",
    proof:"Decisions made in the open by the whole group — not in someone's DMs.", proofKind:"why" },
  { name:"Decidim", cat:"organize", url:"https://decidim.org",
    desc:"Participatory-democracy platform.",
    proof:"Used by cities worldwide to put budgets and proposals in citizens' hands.", proofKind:"proof" },
  { name:"Consul Democracy", cat:"organize", url:"https://consuldemocracy.org",
    desc:"Citizen-participation platform — proposals, budgets, votes.",
    proof:"Democracy as software: propose, deliberate, vote — in public.", proofKind:"why" },
  { name:"CiviCRM", cat:"organize", url:"https://civicrm.org",
    desc:"CRM built for nonprofits and volunteer movements.",
    proof:"Contacts, campaigns, and donations — without handing your member list to Big Tech.", proofKind:"why" },
  { name:"Spoke", cat:"organize", url:"https://github.com/StateVoicesNational/Spoke",
    desc:"Open-source peer-to-peer texting for mobilization.",
    proof:"One volunteer, one phone, thousands of real conversations.", proofKind:"why" },

  // Whistleblowing & journalism
  { name:"SecureDrop", cat:"whistle", url:"https://securedrop.org",
    desc:"Anonymous submission system for sources and journalists.",
    proof:"Trusted by major newsrooms worldwide to protect their sources.", proofKind:"proof" },
  { name:"OnionShare", cat:"whistle", url:"https://onionshare.org",
    desc:"Share files anonymously over Tor.",
    proof:"Files travel directly between people over Tor — no middleman ever holds a copy.", proofKind:"why" },
  { name:"GlobaLeaks", cat:"whistle", url:"https://www.globaleaks.org",
    desc:"Self-hostable whistleblowing platform.",
    proof:"Any newsroom or watchdog can run its own secure leak inbox.", proofKind:"why" },
  { name:"Tails", cat:"whistle", url:"https://tails.net",
    desc:"Amnesic live OS that leaves no trace on the computer.",
    proof:"Boot from a USB stick, shut down, and the computer forgets you were ever there.", proofKind:"why" },
];
