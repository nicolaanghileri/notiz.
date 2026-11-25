//! Zeiträume aus CONTRACT.md: lokale Zeitzone, verglichen wird in UTC.

use chrono::{DateTime, Datelike, Days, NaiveDate, NaiveTime, SecondsFormat, TimeZone, Utc};

use crate::models::{Filter, Range};

/// ISO-8601 UTC mit fester Länge, z. B. `2026-11-25T08:14:00.000Z`.
pub fn iso<Tz: TimeZone>(time: &DateTime<Tz>) -> String {
    time.with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn now_iso() -> String {
    iso(&Utc::now())
}

/// Halboffener Bereich [from, to) für `created_at`. `None` = unbegrenzt.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Bounds {
    pub from: Option<String>,
    pub to: Option<String>,
}

/// Beginn eines lokalen Tages. Fällt Mitternacht in eine Zeitumstellung, gilt
/// der erste gültige Moment danach.
fn day_start<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> String {
    let midnight = date.and_time(NaiveTime::MIN);
    let local = (0..=24)
        .find_map(|quarters| {
            tz.from_local_datetime(&(midnight + chrono::Duration::minutes(15 * quarters)))
                .earliest()
        })
        .map(|time| iso(&time));
    local.unwrap_or_else(|| iso(&midnight.and_utc()))
}

fn since_days<Tz: TimeZone>(now: &DateTime<Tz>, days: u64) -> Bounds {
    let today = now.date_naive();
    let date = today.checked_sub_days(Days::new(days)).unwrap_or(today);
    Bounds {
        from: Some(day_start(&now.timezone(), date)),
        to: None,
    }
}

pub fn filter_bounds<Tz: TimeZone>(filter: Filter, now: &DateTime<Tz>) -> Bounds {
    match filter {
        Filter::Today => since_days(now, 0),
        Filter::Last7 => since_days(now, 6),
        Filter::All | Filter::Quick | Filter::Pinned | Filter::Trash => Bounds::default(),
    }
}

pub fn range_bounds<Tz: TimeZone>(range: Range, now: &DateTime<Tz>) -> Bounds {
    match range {
        Range::All => Bounds::default(),
        Range::LastMonth => since_days(now, 30),
        Range::ThisYear => {
            let new_year = |year| {
                NaiveDate::from_ymd_opt(year, 1, 1).map(|date| day_start(&now.timezone(), date))
            };
            Bounds {
                from: new_year(now.year()),
                to: new_year(now.year() + 1),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    fn now() -> DateTime<FixedOffset> {
        // 00:30 lokal = noch der Vortag in UTC
        DateTime::parse_from_rfc3339("2026-11-25T00:30:00+01:00").unwrap()
    }

    #[test]
    fn days_start_at_local_midnight() {
        let from = |bounds: Bounds| bounds.from.unwrap();
        assert_eq!(
            from(filter_bounds(Filter::Today, &now())),
            "2026-11-24T23:00:00.000Z"
        );
        assert_eq!(
            from(filter_bounds(Filter::Last7, &now())),
            "2026-11-18T23:00:00.000Z"
        );
        assert_eq!(
            from(range_bounds(Range::LastMonth, &now())),
            "2026-10-25T23:00:00.000Z"
        );
    }

    #[test]
    fn this_year_is_the_local_calendar_year() {
        assert_eq!(
            range_bounds(Range::ThisYear, &now()),
            Bounds {
                from: Some("2025-12-31T23:00:00.000Z".into()),
                to: Some("2026-12-31T23:00:00.000Z".into()),
            }
        );
        assert_eq!(range_bounds(Range::All, &now()), Bounds::default());
    }
}
