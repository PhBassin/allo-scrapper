# CONTEXT

Domain glossary for allo-scrapper. Devoid of implementation details — this is what things *mean*, not how they're stored.

## Core entities

### Theater

A cinema venue that screens movies. One Theater is one physical venue, identified by a stable external id.

A Theater has:
- a **name** (which may begin with a brand prefix such as "UGC" or "Pathé")
- an **address**, a city, a postal code
- an **image** and a **booking URL**
- exactly one **Source** it is scraped from (today, `'allocine'` for nearly all rows — see the Source concept below)

The number of screens in a venue is **not a domain attribute** of a Theater here. It was historically collected and displayed, but is being removed — see ADR 0002.

**What a Theater is *not*:**
- A Theater is not a brand. "UGC" is a name prefix; "UGC Bercy" is one Theater. There is no `Brand` entity in this model.
- A Theater is not a data source. The source website is a property of a Theater, not the other way around.
- A Theater is not a count of screens. The number of physical screens in a venue is not a domain attribute here — see ADR 0002.

**Lifecycle:** A Theater is either *active* (row present, scraped on schedule) or it does not exist (row deleted, all history lost via `ON DELETE CASCADE`). There is no soft-delete / closed-state concept: closing a Theater means deleting the row, and all its historical Showtimes and WeeklyPrograms are removed with it. See ADR 0001 for the rationale.

### Showtime

One specific scheduled showing of a Movie at a Theater. A Showtime has a date, a start time, a combined `datetime_iso`, a format (e.g. IMAX, 3D), and a list of "experiences" (e.g. Dolby Atmos, 4DX).

**"Showtimes" (plural) is not a separate concept.** It is the plural of Showtime — used for the table name, query results, and UI page names. The domain has one concept: a Showtime.

**What a Showtime is *not*:**
- Not a **Screening**. The codebase has no entity called Screening. The word appears in docs only as an adjective ("screening schedules"). The canonical term is **Showtime**.
- Not a **Session**. "Session" is reserved for user-auth (cookie sessions, SSE subscriber sessions). Using "session" for a movie showing will collide.
- Not a **Séance**. The table was historically named `seances` (French) and was deliberately renamed to `showtimes` (English) — see `docs/project/white-label-plan.md:580, 596`. The team chose the English word. French comments still say "séance" but that's a comment-language choice, not a domain concept.

### WeeklyProgram

A week-level programming fact: "Movie X is programmed at Theater Y in week W." A WeeklyProgram has a `week_start` date, an `is_new_this_week` flag (true if the movie was newly added to that Theater's program that week), and a `scraped_at` timestamp (when this fact was last confirmed).

**WeeklyProgram is a first-class concept, not derived from Showtimes.** The two entities overlap on `(theater_id, movie_id, week_start)` but carry different facts:
- A Showtime answers *"at what times does this movie screen at this Theater?"*
- A WeeklyProgram answers *"is this movie programmed at this Theater this week, and is it new?"*

The `is_new_this_week` flag cannot be derived from current `showtimes` alone — it requires comparing against prior weeks. The `scraped_at` timestamp records when the programming fact was last confirmed, which is independent of when individual Showtimes were last scraped.

### Source

An external website that publishes showtime data and from which one or more Theaters are scraped. Examples today: `'allocine'`. A Source is an **identity** (a stable string), not a parser.

**Source and Theater:** every Theater has exactly one Source. Today, one Source is used to scrape many Theaters; the data model does not require a Source to be 1:1 with Theaters.

**What a Source is *not*:**
- Not a **Strategy**. A Strategy is the *code* that knows how to scrape a given Source — the parser/adapter. Source is the identity; Strategy is the implementation. The two are 1:1 in the current code, but they are distinct concepts (the strategy can change while the source name stays the same; the source name identifies *what* is being scraped, the strategy identifies *how*).
- Not a **Parser**. A Parser is a helper function inside a Strategy that handles a specific data shape (an HTML page, a JSON blob). Parsers are implementation detail of Strategies, not domain entities.

**Practical note:** "Add support for a new Source" = add a new Strategy whose `sourceName` matches a new Source string. The Source identity is what Theater rows reference; the Strategy is what the scraper wires up.