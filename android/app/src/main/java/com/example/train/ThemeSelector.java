package com.example.train;

import android.app.Activity;
import android.os.Build;

public class ThemeSelector {

    public static void applyTheme(Activity activity) {
        // Use Glass theme for Android 12 (API 31) and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            activity.setTheme(R.style.Theme_Train_Glass);
        } else {
            activity.setTheme(R.style.Theme_Train_Normal);
        }
    }
}