/** 语音决策：与模型选择解耦，按概率独立掷骰 */
export type VoiceAction = 'text' | 'voice';

/**
 * @param modelAction 模型原本选择的 action（text/voice）
 * @param eligible 这条回复是否适合转语音
 * @param chance 0~1；0 永不转，1 总是转
 * @param roll 0~1 随机数（单测可注入）
 */
export function chooseVoiceAction(
  modelAction: VoiceAction,
  eligible: boolean,
  chance: number,
  roll: number,
): VoiceAction {
  if (!eligible) return 'text';
  if (chance <= 0) return 'text';
  if (chance >= 1) return 'voice';
  void modelAction;
  // 关键：不管模型原本选什么，最终都按 chance 独立决定；
  // 这样 80% 就是 80%，而不是「模型偶尔选 voice × 80%」。
  return roll < chance ? 'voice' : 'text';
}
