'use client';
import { useState } from 'react';
import type { ActionLogEntry, Report, SectionKey, Unknown } from '@contract/types';
import { S } from '../strings.en';
import { Group, useToast } from '../components/ui';
import {
  ActionLog, Ask, Packet, Cases, Compare, CostsView, Glance, Hazards, Highlights, History, InfoList, SectionBody, Sources,
  Systems, sectionId, type AskAction,
} from './sections';
import { BookFlow, EmailDialog } from './actions';
import { track } from '../analytics';
import { packetOf } from './packet-types';

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = document.documentElement.classList.contains('reduce-motion');
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

export function ReportView({ report, onRetry, openSource }: { report: Report; onRetry?: () => void; openSource: (n: number, el: HTMLElement) => void }) {
  const [log, setLog] = useState<ActionLogEntry[]>(report.actions);
  const [email, setEmail] = useState<{ kind: 'email_listing_agent' | 'email_city'; ids: string[] } | null>(null);
  const [visit, setVisit] = useState<Unknown | null>(null);
  const toast = useToast();

  const added = (e: ActionLogEntry) => {
    track(e.kind === 'book_specialist' ? 'specialist_requested' : 'email_sent', { kind: e.kind });
    setLog((xs) => (xs.some((x) => x.id === e.id) ? xs : [...xs, e]));
  };

  function onAction(a: AskAction) {
    if (a.kind === 'book') setVisit(a.unknown);
    else if (a.kind === 'brief') {
      const text = a.unknowns.map((u, i) => `${i + 1}. ${u.title}`).join('\n');
      navigator.clipboard?.writeText(`${report.address}\n${text}`).then(() => toast.show(S.briefCopied), () => toast.show(S.linkNotCopied, { error: true }));
    } else setEmail({ kind: a.kind, ids: a.unknownIds });
  }

  const sec = (k: SectionKey) => report.sections[k];
  const packet = packetOf(report);
  const show = (k: SectionKey, n: number) => sec(k)?.state !== 'ok' || n > 0;

  return (
    <>
      <div className="column report cascade">
        <Glance tiles={report.glance} costs={report.costs} onJump={(k) => { track('tile_tapped', { section: k }); scrollToId(sectionId(k)); }} />
        <Highlights good={report.highlights.good} watch={report.highlights.watch} />

        {show('unknowns', report.unknowns.length) ? (
          <Group id={sectionId('unknowns')} title={S.askTitle}>
            <SectionBody state={sec('unknowns')} onRetry={onRetry}><Ask unknowns={report.unknowns} log={log} onAction={onAction} /></SectionBody>
          </Group>
        ) : null}

        {show('ledger', report.ledger.length) ? (
          <Group id={sectionId('ledger')} title={S.compareTitle}>
            <SectionBody state={sec('ledger')} onRetry={onRetry}><Compare rows={report.ledger} /></SectionBody>
          </Group>
        ) : null}

        {packet || sec('packet')?.state === 'error' ? (
          <Group id={sectionId('packet')} title={S.packetTitle}>
            <SectionBody state={sec('packet')} onRetry={onRetry}>{packet && packet.findings.length ? <Packet packet={packet} /> : null}</SectionBody>
          </Group>
        ) : null}

        {show('cases', report.cases.length) ? (
          <Group id={sectionId('cases')} title={S.casesTitle}>
            <SectionBody state={sec('cases')} onRetry={onRetry}><Cases rows={report.cases} /></SectionBody>
          </Group>
        ) : null}

        <Group id={sectionId('costs')} title={S.costsTitle}>
          <SectionBody state={sec('costs')} onRetry={onRetry}><CostsView costs={report.costs} /></SectionBody>
        </Group>

        {show('systems', report.systems.length) ? (
          <Group id={sectionId('systems')} title={S.systemsTitle}>
            <SectionBody state={sec('systems')} onRetry={onRetry}><Systems rows={report.systems} /></SectionBody>
          </Group>
        ) : null}

        {show('tenants', report.tenants.length) ? (
          <Group id={sectionId('tenants')} title={S.tenantsTitle}>
            <SectionBody state={sec('tenants')} onRetry={onRetry}><InfoList rows={report.tenants} /></SectionBody>
          </Group>
        ) : null}

        {show('hazards', report.hazards.length) ? (
          <Group id={sectionId('hazards')} title={S.hazardsTitle}>
            <SectionBody state={sec('hazards')} onRetry={onRetry}><Hazards rows={report.hazards} /></SectionBody>
          </Group>
        ) : null}

        {show('upside', report.upside.length) ? (
          <Group id={sectionId('upside')} title={S.upsideTitle}>
            <SectionBody state={sec('upside')} onRetry={onRetry}><InfoList rows={report.upside} /></SectionBody>
          </Group>
        ) : null}

        {show('nearby', report.nearby.length) ? (
          <Group id={sectionId('nearby')} title={S.nearbyTitle}>
            <SectionBody state={sec('nearby')} onRetry={onRetry}><InfoList rows={report.nearby} /></SectionBody>
          </Group>
        ) : null}

        {show('history', report.history.length) ? (
          <Group id={sectionId('history')} title={S.historyTitle}>
            <SectionBody state={sec('history')} onRetry={onRetry}><History rows={report.history} /></SectionBody>
          </Group>
        ) : null}


        {log.length ? <Group title={S.actionsTitle}><ActionLog entries={log} /></Group> : null}

        <Group id="sources" title={S.sourcesTitle}>
          <Sources sources={report.sources} onOpen={openSource} />
        </Group>

        <p className="fineprint">{S.disclaimer}</p>
      </div>

      <EmailDialog report={report} kind={email?.kind ?? null} unknownIds={email?.ids ?? []} onClose={() => setEmail(null)} onSent={added} />
      <BookFlow report={report} unknown={visit} onClose={() => setVisit(null)} onSent={added} />
    </>
  );
}
