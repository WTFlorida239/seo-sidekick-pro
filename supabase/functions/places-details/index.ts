
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  place_id?: string;
  language?: string;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    console.error("[places-details] Missing GOOGLE_PLACES_API_KEY secret");
    return new Response(
      JSON.stringify({ error: "Server not configured with Google API key." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { place_id, language }: RequestBody = await req.json().catch(() => ({} as RequestBody));

    if (!place_id) {
      return new Response(JSON.stringify({ error: "place_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "international_phone_number",
      "website",
      "rating",
      "user_ratings_total",
      "opening_hours",
      "geometry/location",
      "types",
      "url",
      "utc_offset",
      "price_level",
    ].join(",");

    const params = new URLSearchParams({
      place_id,
      fields,
      key: apiKey,
    });
    if (language) params.set("language", language);

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    console.log("[places-details] Fetching Google Places Details", { place_id, language });

    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json();

    if (!resp.ok) {
      console.error("[places-details] HTTP error from Google", { status: resp.status, data });
      return new Response(
        JSON.stringify({ error: "Google Places request failed", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.status && data.status !== "OK") {
      console.warn("[places-details] Google returned non-OK status", { status: data.status, error_message: data.error_message });
      return new Response(
        JSON.stringify({ error: "Google Places returned non-OK status", details: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const r = data.result || {};
    const normalized = {
      place_id: r.place_id,
      name: r.name,
      formatted_address: r.formatted_address,
      formatted_phone_number: r.formatted_phone_number,
      international_phone_number: r.international_phone_number,
      website: r.website,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
      opening_hours: r.opening_hours?.weekday_text ?? null,
      is_open_now: r.opening_hours?.open_now ?? null,
      location: r.geometry?.location ?? null,
      types: r.types ?? [],
      url: r.url ?? null,
      utc_offset: r.utc_offset ?? null,
      price_level: r.price_level ?? null,
    };

    return new Response(JSON.stringify({ result: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[places-details] Unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
