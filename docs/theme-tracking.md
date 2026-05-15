# Theme interaction tracking

This tracker publishes custom Shopify Customer Events so the Custom Pixel can send image-level attribution signals to the MVP backend.

## Install

1. In the Shopify theme code editor, create:

   ```txt
   snippets/attribution-analysis-tracker.liquid
   ```

2. Paste the contents of:

   ```txt
   shopify/theme-snippets/attribution-analysis-tracker.liquid
   ```

3. In `layout/theme.liquid`, render it before `</body>`:

   ```liquid
   {% render 'attribution-analysis-tracker' %}
   ```

## Custom events

The snippet publishes:

```txt
attribution_analysis:collection_product_impression
attribution_analysis:collection_product_click
attribution_analysis:product_media_viewed
attribution_analysis:product_media_clicked
attribution_analysis:add_to_cart_attribution_snapshot
```

These events include fields such as:

```txt
surface
list_name
card_position
media_id
media_url
media_position
media_alt
product_id
variant_id
product_handle
product_title
interaction_target
```

## What this answers

- Which landing source brought the visitor.
- Which product card image was visible before a click.
- Which product media image was viewed or clicked before add to cart.
- Which image was closest to the add-to-cart action.
- Which image signals appear in sessions that later reach checkout or purchase.
