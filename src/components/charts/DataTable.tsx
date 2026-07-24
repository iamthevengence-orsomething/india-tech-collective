import { useMemo, useState } from 'react';
import type { PoliticianIndexRow } from '../../lib/schemas/artifacts';

/**
 * Sortable, paginated representative table. Screen-reader friendly: real
 * <table> semantics, aria-sort, no virtualization (543 rows paginate fine).
 */
const PAGE_SIZE = 25;

type SortKey = 'name' | 'stateName' | 'constituency' | 'partyShort' | 'declaredCases' | 'convictionsDeclared';

const fmt = (n: number | null) => (n === null ? '—' : String(n));

export default function DataTable({ rows }: { rows: PoliticianIndexRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [dir, setDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return copy;
  }, [rows, sortKey, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pages - 1);
  const visible = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const header = (key: SortKey, label: string, numeric = false) => (
    <th
      scope="col"
      className={numeric ? 'num' : undefined}
      aria-sort={sortKey === key ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSortKey(key);
            setDir(numeric ? -1 : 1);
          }
          setPage(0);
        }}
        style={{ fontWeight: 600, letterSpacing: 'inherit', textTransform: 'inherit', fontSize: 'inherit', color: 'inherit' }}
      >
        {label} {sortKey === key ? (dir === 1 ? '↑' : '↓') : ''}
      </button>
    </th>
  );

  return (
    <div>
      <div className="table-scroll">
        <table className="data">
          <caption>
            Representatives in the current filter — declared-case counts are self-declared in election
            affidavits (accusations, not convictions). “—” means no affidavit-derived data.
          </caption>
          <thead>
            <tr>
              {header('name', 'Representative')}
              {header('stateName', 'State/UT')}
              {header('constituency', 'Constituency')}
              {header('partyShort', 'Party (at election)')}
              {header('declaredCases', 'Declared cases', true)}
              {header('convictionsDeclared', 'Declared convictions', true)}
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <th scope="row" style={{ fontWeight: 600 }}>
                  <a href={`/politicians/${r.slug}/`}>{r.name}</a>
                </th>
                <td>{r.stateName}</td>
                <td>{r.constituency}</td>
                <td><span title={r.party}>{r.partyShort}</span></td>
                <td className="num">{fmt(r.declaredCases)}</td>
                <td className="num">{fmt(r.convictionsDeclared)}</td>
                <td>
                  {r.hasSeriousDeclared === true && <span className="chip">serious-case criteria</span>}{' '}
                  {r.pcActCase === true && <span className="chip chip-data">PC Act</span>}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state" style={{ border: 'none' }}>
                    No representatives match the current filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="filter-bar" aria-label="Table pages" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-small" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            ← Previous
          </button>
          <span className="small" aria-live="polite">
            Page {clampedPage + 1} of {pages}
          </span>
          <button type="button" className="btn btn-small" disabled={clampedPage >= pages - 1} onClick={() => setPage(clampedPage + 1)}>
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
