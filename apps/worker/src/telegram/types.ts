import { z } from "zod";

/** Schemas mínimos da Bot API usados pelo webhook (campos extras são ignorados). */
const User = z.object({ id: z.number(), is_bot: z.boolean().optional(), first_name: z.string().optional(), username: z.string().optional() });
const Chat = z.object({ id: z.number(), type: z.string() });
const PhotoSize = z.object({ file_id: z.string(), file_unique_id: z.string(), width: z.number(), height: z.number(), file_size: z.number().optional() });

export const TelegramMessageSchema = z.object({
  message_id: z.number(),
  from: User.optional(),
  chat: Chat,
  date: z.number(),
  text: z.string().optional(),
  caption: z.string().optional(),
  voice: z
    .object({ file_id: z.string(), file_unique_id: z.string(), duration: z.number(), mime_type: z.string().optional(), file_size: z.number().optional() })
    .optional(),
  audio: z
    .object({ file_id: z.string(), file_unique_id: z.string(), duration: z.number(), mime_type: z.string().optional(), file_size: z.number().optional() })
    .optional(),
  photo: z.array(PhotoSize).optional(),
  document: z.object({ file_id: z.string(), file_unique_id: z.string(), mime_type: z.string().optional(), file_size: z.number().optional() }).optional(),
});
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
  edited_message: TelegramMessageSchema.optional(),
  callback_query: z
    .object({
      id: z.string(),
      from: User,
      message: z.object({ message_id: z.number(), chat: Chat }).optional(),
      data: z.string().optional(),
    })
    .optional(),
});
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
