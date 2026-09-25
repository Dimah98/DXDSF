package ua.diperon.slbotremote

/**
 * Природний (числовий) компаратор для сортування рядків, що містять числа.
 * Наприклад: SF, SF1, SF2, ..., SF9, SF10, SF11 замість SF, SF1, SF10, SF11, SF2.
 */
object NaturalOrderComparator : Comparator<String> {
    private val REGEX = "(\\d+)|(\\D+)".toRegex()

    override fun compare(a: String?, b: String?): Int {
        if (a == null && b == null) return 0
        if (a == null) return -1
        if (b == null) return 1

        val aTokens = REGEX.findAll(a).map { it.value }.toList()
        val bTokens = REGEX.findAll(b).map { it.value }.toList()
        val minSize = minOf(aTokens.size, bTokens.size)

        for (i in 0 until minSize) {
            val aTok = aTokens[i]
            val bTok = bTokens[i]
            if (aTok != bTok) {
                val aNum = aTok.toLongOrNull()
                val bNum = bTok.toLongOrNull()
                if (aNum != null && bNum != null) {
                    val comp = aNum.compareTo(bNum)
                    if (comp != 0) return comp
                } else {
                    val comp = aTok.compareTo(bTok, ignoreCase = true)
                    if (comp != 0) return comp
                }
            }
        }
        return aTokens.size.compareTo(bTokens.size)
    }
}
