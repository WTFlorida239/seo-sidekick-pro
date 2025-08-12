
import { supabase } from "@/integrations/supabase/client";

export type NormalizedPlace = {
  place_id: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: string[] | null;
  is_open_now?: boolean | null;
  location?: { lat: number; lng: number } | null;
  types?: string[];
  url?: string | null;
  utc_offset?: number | null;
  price_level?: number | null;
};

export async function getPlaceDetails(placeId: string, language?: string) {
  console.log("[getPlaceDetails] Invoking edge function with", { placeId, language });
  const { data, error } = await supabase.functions.invoke("places-details", {
    body: { place_id: placeId, language },
  });

  if (error) {
    console.error("[getPlaceDetails] Error invoking function", error);
    throw error;
  }

  return data as { result: NormalizedPlace };
}
