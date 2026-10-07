import { useEffect, useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const TOKEN_KEY = "voice_token";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Screen({ children, wide = false, center = false }) {
  return (
    <div
      className={`min-h-svh text-clay-ink ${center ? "flex items-center justify-center" : ""}`}
    >
      <div
        className={`mx-auto w-full px-6 ${center ? "py-8" : "py-16 sm:py-24"} ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ClayButton({
  active = false,
  accent = false,
  className = "",
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`clay-btn ${accent ? "clay-btn-accent" : ""} ${active ? "is-in" : ""} ${className}`}
      {...props}
    />
  );
}

function gradientStyle(colors) {
  if (!colors?.length) return undefined;
  return {
    backgroundImage: `linear-gradient(120deg, ${colors.join(", ")})`,
    backgroundSize: "220% 220%",
  };
}

function TitleBadge({ title, className = "" }) {
  if (!title?.name) return null;
  const isOwner = title.kind === "owner" || title.id === "owner";
  const isGift = title.kind === "gift";
  const tone = isOwner
    ? "title-badge-owner"
    : isGift
      ? "title-badge-gift"
      : "title-badge-static";
  const style = isOwner
    ? gradientStyle(title.gradient)
    : isGift
      ? gradientStyle(title.gradient)
      : { color: title.color || "#6b8f71" };
  return (
    <span className={`title-badge ${tone} ${className}`} style={style}>
      {isOwner ? "👑 " : null}[{title.name}]
    </span>
  );
}

function AuthorLine({ username, title, createdAt }) {
  return (
    <p className="text-sm text-clay-muted">
      {title ? (
        <>
          <TitleBadge title={title} />{" "}
        </>
      ) : null}
      <span>{username}</span>
      {createdAt ? <> · {formatDate(createdAt)}</> : null}
    </p>
  );
}

function GlitterBurst() {
  const bits = Array.from({ length: 28 }, (_, index) => {
    const left = `${(index * 37) % 100}%`;
    const delay = `${(index % 7) * 0.08}s`;
    const duration = `${1.4 + (index % 5) * 0.18}s`;
    const size = `${4 + (index % 4)}px`;
    return (
      <span
        key={index}
        className="glitter-bit"
        style={{
          left,
          animationDelay: delay,
          animationDuration: duration,
          width: size,
          height: size,
        }}
      />
    );
  });
  return <div className="glitter-field" aria-hidden="true">{bits}</div>;
}

function GiftPopup({ gift, onClose }) {
  if (!gift) return null;
  const from = gift.from || "GrimmyEnding";
  return (
    <div className="clay-overlay gift-popup-overlay fixed inset-0 z-30 flex items-center justify-center px-6">
      <div className="clay clay-enter gift-popup relative w-full max-w-md overflow-hidden px-8 py-10 text-center">
        <GlitterBurst />
        <p className="relative z-10 text-sm tracking-wide text-clay-muted">A gift arrived</p>
        <p className="relative z-10 mt-5 text-2xl leading-snug sm:text-3xl">
          {from} has gifted you the title{" "}
          <TitleBadge
            title={{
              name: gift.name,
              kind: gift.kind || "gift",
              gradient: gift.gradient,
            }}
          />
        </p>
        <ClayButton accent className="relative z-10 mt-8" onClick={onClose}>
          Wear it proudly
        </ClayButton>
      </div>
    </div>
  );
}

function GoogleClayButton({ onSuccess, onError }) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) =>
      onSuccess({ access_token: tokenResponse.access_token }),
    onError,
    scope: "openid email profile",
  });

  return (
    <button type="button" className="clay-btn-google" onClick={() => login()}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
      Sign in with Google
    </button>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [content, setContent] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState("feed");
  const [sort, setSort] = useState("date");
  const [stories, setStories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [giftPopup, setGiftPopup] = useState(null);
  const [giftUsername, setGiftUsername] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [gifting, setGifting] = useState(false);

  function applyStats(data) {
    if (typeof data?.totalUsers !== "number" && typeof data?.activeUsers !== "number") {
      return;
    }
    setStats({
      totalUsers: data.totalUsers || 0,
      activeUsers: data.activeUsers || 0,
    });
    setStatsLoaded(true);
  }

  function maybeShowGift(nextUser) {
    if (nextUser?.pendingGift) {
      setGiftPopup(nextUser.pendingGift);
    }
  }

  useEffect(() => {
    if (user?.pendingGift) {
      setGiftPopup(user.pendingGift);
    }
  }, [user?.pendingGift?.id, user?.pendingGift?.name]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      for (const path of ["/stats", "/health"]) {
        try {
          const res = await fetch(`${API}${path}`);
          const data = await res.json();
          if (!cancelled && res.ok && typeof data.totalUsers === "number") {
            applyStats(data);
            return;
          }
        } catch {
          /* try the next endpoint */
        }
      }
    }

    loadStats();
    const timer = setInterval(loadStats, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, {
          headers: authHeaders(token),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Session expired");
        if (!cancelled) {
          setUser(data.user);
          applyStats(data);
          maybeShowGift(data.user);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !user?.username || view !== "feed") return;
    let cancelled = false;

    (async () => {
      const res = await fetch(`${API}/stories?sort=${sort}`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!cancelled && res.ok) {
        setStories(data.stories || []);
        applyStats(data);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, view, sort]);

  useEffect(() => {
    if (!token || !user?.username || view !== "profile") return;
    let cancelled = false;

    (async () => {
      const res = await fetch(`${API}/profile`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (!cancelled && res.ok) {
        setProfile(data);
        if (data.user) setUser(data.user);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.username, view]);

  useEffect(() => {
    if (!composing) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event) {
      if (event.key === "Escape" && !publishing) closeCompose();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [composing, publishing]);

  function openCompose() {
    setError("");
    setNotice("");
    setComposing(true);
  }

  function closeCompose() {
    if (publishing) return;
    setComposing(false);
  }

  async function onGoogleSuccess(body) {
    setError("");
    const res = await fetch(`${API}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sign in failed");
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    applyStats(data);
    maybeShowGift(data.user);
  }

  async function submitUsername(event) {
    event.preventDefault();
    setError("");
    const res = await fetch(`${API}/auth/username`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not set username");
      return;
    }
    setUser(data.user);
  }

  async function publishStory(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPublishing(true);
    try {
      const res = await fetch(`${API}/stories`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.reason || data.error || "Could not publish story");
        return;
      }
      setContent("");
      setComposing(false);
      setNotice("Your story is live.");
      setStories((current) => [data.story, ...current]);
      setView("feed");
    } finally {
      setPublishing(false);
    }
  }

  async function deleteStory(id) {
    if (!window.confirm("Delete this story? This cannot be undone.")) return;
    setError("");
    const res = await fetch(`${API}/stories/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not delete story");
      return;
    }
    setStories((current) => current.filter((story) => story.id !== id));
    setProfile((current) => {
      if (!current) return current;
      const nextStories = current.stories.filter((story) => story.id !== id);
      return {
        ...current,
        stories: nextStories,
        totalUpvotes: nextStories.reduce(
          (sum, story) => sum + (story.upvoteCount || 0),
          0
        ),
      };
    });
  }

  async function upvoteStory(id) {
    setError("");
    const res = await fetch(`${API}/stories/${id}/upvote`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not upvote");
      return;
    }
    setStories((current) =>
      current.map((story) => (story.id === id ? data.story : story))
    );
    setProfile((current) => {
      if (!current) return current;
      const nextStories = current.stories.map((story) =>
        story.id === id ? data.story : story
      );
      return {
        ...current,
        stories: nextStories,
        totalUpvotes: nextStories.reduce(
          (sum, story) => sum + (story.upvoteCount || 0),
          0
        ),
      };
    });
  }

  async function selectTitle(titleId) {
    setError("");
    const res = await fetch(`${API}/profile/title`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(
        titleId === "none"
          ? { titleId: "none", showTitle: false }
          : { titleId, showTitle: true }
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update title");
      return;
    }
    setUser(data.user);
    setProfile((current) =>
      current
        ? { ...current, user: data.user, catalog: data.catalog || current.catalog }
        : current
    );
  }

  async function ackGift() {
    const giftId = giftPopup?.id;
    if (!giftId || !token) {
      setGiftPopup(null);
      return;
    }
    const res = await fetch(`${API}/profile/gift/ack`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ giftId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not close gift");
      return;
    }
    if (data.user) setUser(data.user);
    setGiftPopup(data.user?.pendingGift || null);
  }

  async function giftTitleToUser(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setGifting(true);
    try {
      const res = await fetch(`${API}/admin/gift-title`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          username: giftUsername,
          name: giftTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not gift title");
        return;
      }
      setNotice(`Gifted [${data.gift.name}] to ${data.user.username}.`);
      setGiftUsername("");
      setGiftTitle("");
    } finally {
      setGifting(false);
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setUsername("");
    setContent("");
    setError("");
    setNotice("");
    setStories([]);
    setProfile(null);
    setView("feed");
    setComposing(false);
    setGiftPopup(null);
  }

  if (loading) {
    return (
      <Screen center>
        <div className="clay clay-enter px-8 py-10">
          <p className="text-clay-muted">Loading…</p>
        </div>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen center>
        <div className="clay clay-enter px-8 py-12 sm:px-10 sm:py-14">
          <h1 className="text-6xl font-normal tracking-tight sm:text-7xl">voice</h1>
          <p className="mt-4 text-xl text-clay-muted italic">
            Tell the world your story.
          </p>
          {GOOGLE_CLIENT_ID ? (
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleClayButton
                onSuccess={onGoogleSuccess}
                onError={() => setError("Google sign-in failed")}
              />
            </GoogleOAuthProvider>
          ) : (
            <p className="mt-12">
              Add the same Google OAuth client ID to frontend/.env and backend/.env,
              then restart both servers.
            </p>
          )}
          {statsLoaded ? (
            <p className="clay-inset mt-10 px-5 py-3 text-lg">
              {stats.totalUsers.toLocaleString()}{" "}
              {stats.totalUsers === 1 ? "person is" : "people are"} already on voice
            </p>
          ) : null}
          {error ? <p className="mt-8">{error}</p> : null}
        </div>
      </Screen>
    );
  }

  if (!user.username) {
    return (
      <Screen center>
        <div className="clay clay-enter px-8 py-12 sm:px-10">
          <h1 className="text-5xl font-normal tracking-tight">Choose a username</h1>
          <p className="mt-4 text-lg text-clay-muted">
            This is the only name others will see on your stories.
          </p>
          {statsLoaded ? (
            <p className="mt-4 text-lg">
              {stats.totalUsers.toLocaleString()}{" "}
              {stats.totalUsers === 1 ? "person is" : "people are"} already here
            </p>
          ) : null}
          <form onSubmit={submitUsername} className="mt-12 flex items-center gap-3">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              autoComplete="username"
              autoFocus
              className="clay-inset min-w-0 flex-1 px-5 py-3 text-lg"
            />
            <ClayButton type="submit" accent>
              Save
            </ClayButton>
          </form>
          {error ? <p className="mt-8">{error}</p> : null}
        </div>
      </Screen>
    );
  }

  const receivedUpvotes = (profile?.stories || []).reduce(
    (sum, story) => sum + (story.upvoteCount || 0),
    0
  );
  const catalog = profile?.catalog;
  const unlockedAchievements = (catalog?.achievements || []).filter((t) => t.unlocked);
  const lockedAchievements = (catalog?.achievements || []).filter((t) => !t.unlocked);
  const giftTitles = catalog?.gifts || [];

  return (
    <Screen wide>
      <header className="clay flex items-center justify-between gap-3 px-5 py-5 sm:gap-4 sm:px-8 sm:py-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">voice</h1>
          {view === "feed" && statsLoaded ? (
            <p className="mt-1 text-sm sm:mt-2 sm:text-lg">
              {stats.activeUsers.toLocaleString()}{" "}
              {stats.activeUsers === 1 ? "person" : "people"} here now
            </p>
          ) : null}
        </div>
        <nav className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
          <ClayButton
            className="clay-btn-nav"
            active={view === "feed"}
            onClick={() => setView("feed")}
          >
            Feed
          </ClayButton>
          <ClayButton className="clay-btn-nav" onClick={openCompose}>
            Write
          </ClayButton>
          <ClayButton
            className="clay-btn-nav"
            active={view === "profile"}
            onClick={() => setView("profile")}
          >
            Profile
          </ClayButton>
          <ClayButton className="clay-btn-nav" onClick={signOut}>
            Sign out
          </ClayButton>
        </nav>
      </header>

      {view === "feed" ? (
        <section className="mt-10">
          {notice ? (
            <p className="clay-inset mb-6 px-5 py-3 text-clay-muted">{notice}</p>
          ) : null}
          {error && !composing ? (
            <p className="clay-inset mb-6 px-5 py-3">{error}</p>
          ) : null}
          {user.isAdmin ? (
            <form
              onSubmit={giftTitleToUser}
              className="clay mb-6 flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center"
            >
              <p className="shrink-0 text-sm text-clay-muted">Gift a title</p>
              <input
                value={giftUsername}
                onChange={(event) => setGiftUsername(event.target.value)}
                placeholder="username"
                className="clay-inset min-w-0 flex-1 px-4 py-2"
              />
              <input
                value={giftTitle}
                onChange={(event) => setGiftTitle(event.target.value)}
                placeholder="title name"
                className="clay-inset min-w-0 flex-1 px-4 py-2"
              />
              <ClayButton type="submit" accent disabled={gifting}>
                {gifting ? "Gifting…" : "Gift"}
              </ClayButton>
            </form>
          ) : null}
          <div className="mb-6 flex gap-2">
            <ClayButton active={sort === "date"} onClick={() => setSort("date")}>
              Latest
            </ClayButton>
            <ClayButton
              active={sort === "upvotes"}
              onClick={() => setSort("upvotes")}
            >
              Top
            </ClayButton>
          </div>
          <StoryList
            stories={stories}
            onUpvote={upvoteStory}
            onDelete={user.isAdmin ? deleteStory : undefined}
            canDeleteAll={user.isAdmin}
          />
        </section>
      ) : (
        <section className="mt-10">
          {error && !composing ? (
            <p className="clay-inset mb-6 px-5 py-3">{error}</p>
          ) : null}
          <div className="clay px-8 py-8">
            <AuthorLine username={user.username} title={user.title} />
            <p className="mt-2 text-clay-muted">{user.email}</p>
            <p className="mt-8 text-xl">
              {profile
                ? `${receivedUpvotes} ${receivedUpvotes === 1 ? "upvote" : "upvotes"} received`
                : "Loading…"}
            </p>
            {profile ? (
              <p className="mt-2 text-clay-muted">
                {profile.postCount || 0}{" "}
                {(profile.postCount || 0) === 1 ? "story" : "stories"} published
              </p>
            ) : null}
            <a
              className="clay-btn mt-8 inline-flex"
              href={`mailto:voicesupportnow@gmail.com?subject=${encodeURIComponent(
                `voice message from ${user.username}`
              )}`}
            >
              Message me
            </a>
          </div>

          {profile ? (
            <div className="clay mt-6 px-8 py-8">
              <p className="text-2xl tracking-tight">Your titles</p>
              <p className="mt-2 text-clay-muted">
                Choose what shows before your name on posts.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <ClayButton
                  active={!user.showTitle || !user.activeTitleId}
                  onClick={() => selectTitle("none")}
                >
                  No title
                </ClayButton>
                {unlockedAchievements.map((title) => (
                  <ClayButton
                    key={title.id}
                    active={user.activeTitleId === title.id}
                    onClick={() => selectTitle(title.id)}
                  >
                    <TitleBadge title={title} />
                  </ClayButton>
                ))}
                {giftTitles.map((title) => (
                  <ClayButton
                    key={title.id}
                    active={user.activeTitleId === title.id}
                    onClick={() => selectTitle(title.id)}
                  >
                    <TitleBadge title={title} />
                  </ClayButton>
                ))}
              </div>

              {lockedAchievements.length ? (
                <div className="mt-8">
                  <p className="text-sm text-clay-muted">Still locked</p>
                  <ul className="mt-3 space-y-2 text-clay-muted">
                    {lockedAchievements.map((title) => (
                      <li key={title.id}>
                        <TitleBadge title={title} /> — {title.requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {profile ? (
            <StoryList stories={profile.stories} onDelete={deleteStory} />
          ) : null}
        </section>
      )}

      {composing ? (
        <div
          className="clay-overlay fixed inset-0 z-10 flex items-start justify-center overflow-auto px-6 py-16 sm:items-center"
          style={{ background: "#eadfcc" }}
          onClick={closeCompose}
        >
          <form
            onSubmit={publishStory}
            onClick={(event) => event.stopPropagation()}
            className="clay clay-enter w-full max-w-xl px-8 py-8"
          >
            <p className="text-sm tracking-wide text-clay-muted">New story</p>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={50000}
              placeholder="Tell the world your story."
              autoFocus
              className="clay-inset mt-6 h-72 w-full resize-y p-5 text-lg leading-relaxed"
            />
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-sm text-clay-muted">
                {content.length.toLocaleString()}/50,000
              </span>
              <div className="flex items-center gap-2">
                <ClayButton onClick={closeCompose} disabled={publishing}>
                  Cancel
                </ClayButton>
                <ClayButton
                  type="submit"
                  accent
                  disabled={publishing || !content.trim()}
                >
                  {publishing ? "Checking…" : "Publish"}
                </ClayButton>
              </div>
            </div>
            {error ? <p className="mt-6">{error}</p> : null}
          </form>
        </div>
      ) : null}

      <GiftPopup gift={giftPopup} onClose={ackGift} />
    </Screen>
  );
}

function StoryList({ stories, onUpvote, onDelete, canDeleteAll = false }) {
  if (!stories.length) {
    return (
      <p className="clay mt-8 px-8 py-10 text-clay-muted">No stories yet.</p>
    );
  }

  return (
    <ul className="story-list mt-2 space-y-6">
      {stories.map((story) => (
        <li key={story.id} className="clay px-7 py-7">
          <AuthorLine
            username={story.authorUsername}
            title={story.authorTitle}
            createdAt={story.createdAt}
          />
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">
            {story.content}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onUpvote ? (
              <ClayButton
                active={story.upvoted}
                disabled={story.upvoted}
                onClick={() => onUpvote(story.id)}
              >
                {story.upvoted ? "Upvoted" : "Upvote"} · {story.upvoteCount}
              </ClayButton>
            ) : (
              <p className="clay-inset w-fit px-4 py-2">
                {story.upvoteCount}{" "}
                {story.upvoteCount === 1 ? "upvote" : "upvotes"}
              </p>
            )}
            {onDelete ? (
              <ClayButton onClick={() => onDelete(story.id)}>
                {canDeleteAll ? "Delete" : "Delete"}
              </ClayButton>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
