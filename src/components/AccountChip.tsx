import { IDENTITY_HUB, signInUrl, type Account } from '../hooks/useAccount';

/** Shared th3scr1b3.art login: sign in on the identity hub, the session follows you here. */
export function AccountChip({ account }: { account: Account }) {
  if (account.status === 'loading') {
    return (
      <span className="account account-out" aria-busy="true">
        <span className="account-avatar">·</span>
        <span className="account-name">…</span>
      </span>
    );
  }

  if (!account.user) {
    return (
      <a className="account account-out" href={signInUrl()} title="One login for every th3scr1b3.art layer">
        <span className="account-avatar">?</span>
        <span className="account-name">Sign in</span>
      </a>
    );
  }

  return (
    <a className="account" href={IDENTITY_HUB} title="Your th3scr1b3 profile">
      <span className="account-avatar">
        {account.avatarUrl ? (
          <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          account.displayName.charAt(0).toUpperCase()
        )}
      </span>
      <span className="account-name">{account.displayName}</span>
      {account.isAdmin && <span className="chip chip-amber">Admin</span>}
    </a>
  );
}
