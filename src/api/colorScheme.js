import { supabase } from './supabaseClient';

export const BASE44_COLORS = {
  softGreen: '#AACC96',
  darkForestGreen: '#25533F',
  peach: '#F4BEAE',
  skyBlue: '#52A5CE',
  pink: '#FF7BAC',
  brown: '#876029',
  burgundy: '#6D1F42',
  lavender: '#D3B6D3',
  yellow: '#EFCE7B',
  lightBlue: '#B8CEE8',
  orange: '#EF6F3C',
  olive: '#AFAB23',
};

export const CHART_COLORS = [
  BASE44_COLORS.skyBlue,
  BASE44_COLORS.softGreen,
  BASE44_COLORS.orange,
  BASE44_COLORS.yellow,
  BASE44_COLORS.pink,
  BASE44_COLORS.peach,
  BASE44_COLORS.lightBlue,
  BASE44_COLORS.lavender,
  BASE44_COLORS.burgundy,
  BASE44_COLORS.brown,
  BASE44_COLORS.olive,
  BASE44_COLORS.darkForestGreen,
];

export async function getActiveColorScheme() {
  const { data, error } = await supabase
    .from('color_schemes')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching color scheme:', error);
    return null;
  }

  return data;
}

export async function getUserColorSchemes() {
  const { data, error } = await supabase
    .from('color_schemes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user color schemes:', error);
    return [];
  }

  return data || [];
}

export async function createColorScheme(name, colors) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('color_schemes')
    .insert({
      name,
      colors,
      created_by: user?.id,
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating color scheme:', error);
    throw error;
  }

  return data;
}

export async function updateColorScheme(id, updates) {
  const { data, error } = await supabase
    .from('color_schemes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating color scheme:', error);
    throw error;
  }

  return data;
}

export async function setActiveColorScheme(id) {
  await supabase
    .from('color_schemes')
    .update({ is_active: false })
    .neq('id', id);

  const { data, error } = await supabase
    .from('color_schemes')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error setting active color scheme:', error);
    throw error;
  }

  return data;
}

export async function deleteColorScheme(id) {
  const { error } = await supabase
    .from('color_schemes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting color scheme:', error);
    throw error;
  }
}

export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}
