import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthenticated } from '@/app/lib/auth';
import { saveFile, getPublicUrl } from '@/app/lib/storage';
import { query } from '@/app/lib/db';
import type { WeeklyMenu } from '@/app/types';

function createAltText(fullText: string): string {
  if (fullText.length <= 150) return fullText;
  const truncated = fullText.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

function menuToText(menu: WeeklyMenu): string {
  return menu.days
    .map((day) => {
      const meals = day.meals.map((m) => `${m.name} ${m.price} Kč`).join(', ');
      return `${day.day} ${day.date}: ${meals}`;
    })
    .join('. ');
}

async function extractMenu(imageBuffer: Buffer): Promise<WeeklyMenu | null> {
  try {
    const client = new Anthropic();
    const base64 = imageBuffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/webp', data: base64 },
            },
            {
              type: 'text',
              text: `Analyzuj tento obrázek týdenní nabídky jídel. Vrať POUZE validní JSON v tomto formátu, nic dalšího:
{"days":[{"day":"Pondělí","date":"YYYY-MM-DD","meals":[{"name":"Název jídla","price":145}]}]}
Pokud datum není na obrázku, odhadni ho podle aktuálního týdne. Cenu uveď jako číslo bez Kč.`,
            },
          ],
        },
      ],
    });

    for (const block of response.content) {
      if (block.type === 'text') {
        const text = block.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as WeeklyMenu;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file || !type) {
    return NextResponse.json({ message: 'File or type not provided' }, { status: 400 });
  }

  const filename = `${type}.webp`;
  const imageBuffer = Buffer.from(await file.arrayBuffer());

  await saveFile('menu', filename, imageBuffer);

  const url = getPublicUrl('menu', filename);
  let menuSaved = false;

  if (type === 'weekly') {
    const menu = await extractMenu(imageBuffer);
    if (menu) {
      await query(
        'INSERT INTO weekly_menu (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
        [JSON.stringify(menu)]
      );
      menuSaved = true;

      const fullText = menuToText(menu);
      const altText = createAltText(fullText);
      await query(
        `INSERT INTO menu_images (type, full_text, alt_text) VALUES ($1, $2, $3)
         ON CONFLICT (type) DO UPDATE SET full_text = $2, alt_text = $3`,
        [type, fullText, altText]
      );
    }
  }

  return NextResponse.json({ url, menuSaved });
}
