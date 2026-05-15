update events e
set
  landing_page = coalesce(e.landing_page, s.landing_page),
  referrer = coalesce(e.referrer, s.referrer),
  utm_source = coalesce(e.utm_source, s.utm_source),
  utm_medium = coalesce(e.utm_medium, s.utm_medium),
  utm_campaign = coalesce(e.utm_campaign, s.utm_campaign),
  utm_content = coalesce(e.utm_content, s.utm_content),
  utm_term = coalesce(e.utm_term, s.utm_term),
  gclid = coalesce(e.gclid, s.gclid),
  fbclid = coalesce(e.fbclid, s.fbclid),
  device = coalesce(e.device, s.device),
  country = coalesce(e.country, s.country)
from sessions s
where e.session_id = s.session_id;

update visitors v
set
  first_landing_page = coalesce(v.first_landing_page, s.landing_page),
  first_referrer = coalesce(v.first_referrer, s.referrer),
  first_utm_source = coalesce(v.first_utm_source, s.utm_source),
  first_utm_medium = coalesce(v.first_utm_medium, s.utm_medium),
  first_utm_campaign = coalesce(v.first_utm_campaign, s.utm_campaign)
from (
  select distinct on (visitor_id)
    visitor_id,
    landing_page,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign
  from sessions
  order by visitor_id, started_at asc
) s
where v.visitor_id = s.visitor_id;

update touchpoints t
set
  source = coalesce(t.source, s.utm_source),
  medium = coalesce(t.medium, s.utm_medium),
  campaign = coalesce(t.campaign, s.utm_campaign),
  content = coalesce(t.content, s.utm_content),
  term = coalesce(t.term, s.utm_term),
  landing_page = coalesce(t.landing_page, s.landing_page),
  referrer = coalesce(t.referrer, s.referrer),
  click_id = coalesce(t.click_id, s.gclid, s.fbclid),
  channel = case
    when coalesce(t.click_id, s.gclid) is not null
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%cpc%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%ppc%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%paidsearch%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%paid_search%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%shopping%' then 'paid_search'
    when coalesce(s.fbclid, '') <> ''
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%paid_social%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%paidsocial%' then 'paid_social'
    when (
      lower(coalesce(t.source, s.utm_source, '')) like '%facebook%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%instagram%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%meta%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%tiktok%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%pinterest%'
    ) and lower(coalesce(t.medium, s.utm_medium, '')) like '%paid%' then 'paid_social'
    when lower(coalesce(t.medium, s.utm_medium, '')) = 'email'
      or lower(coalesce(t.source, s.utm_source, '')) like '%klaviyo%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%mailchimp%' then 'email'
    when lower(coalesce(t.medium, s.utm_medium, '')) = 'sms'
      or lower(coalesce(t.source, s.utm_source, '')) like '%sms%' then 'sms'
    when lower(coalesce(t.medium, s.utm_medium, '')) like '%affiliate%'
      or lower(coalesce(t.source, s.utm_source, '')) like '%affiliate%' then 'affiliate'
    when lower(coalesce(t.medium, s.utm_medium, '')) like '%product_sync%'
      or lower(coalesce(t.medium, s.utm_medium, '')) like '%organic_shopping%'
      or lower(coalesce(t.campaign, s.utm_campaign, '')) like '%sag_organic%' then 'organic_search'
    when lower(coalesce(t.medium, s.utm_medium, '')) like '%organic%'
      and (
        lower(coalesce(t.source, s.utm_source, '')) like '%facebook%'
        or lower(coalesce(t.source, s.utm_source, '')) like '%instagram%'
        or lower(coalesce(t.source, s.utm_source, '')) like '%twitter%'
        or lower(coalesce(t.source, s.utm_source, '')) like '%tiktok%'
        or lower(coalesce(t.source, s.utm_source, '')) like '%pinterest%'
      ) then 'organic_social'
    when lower(coalesce(t.medium, s.utm_medium, '')) like '%organic%' then 'organic_search'
    when lower(coalesce(t.referrer, s.referrer, '')) like '%google.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%bing.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%yahoo.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%duckduckgo.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%baidu.%' then 'organic_search'
    when lower(coalesce(t.referrer, s.referrer, '')) like '%facebook.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%instagram.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%t.co%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%twitter.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%x.com%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%pinterest.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%tiktok.%'
      or lower(coalesce(t.referrer, s.referrer, '')) like '%linkedin.%' then 'organic_social'
    when coalesce(t.referrer, s.referrer) is not null then 'referral'
    when coalesce(t.source, s.utm_source) is null
      and coalesce(t.medium, s.utm_medium) is null
      and coalesce(t.referrer, s.referrer) is null then 'direct'
    else 'unknown'
  end
from sessions s
where t.session_id = s.session_id;
